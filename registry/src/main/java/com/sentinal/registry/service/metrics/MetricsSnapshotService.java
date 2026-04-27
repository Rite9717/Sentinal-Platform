package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class MetricsSnapshotService {

    private final MetricSnapshotRepository snapshotRepository;
    private final PrometheusService prometheusService;

    @Value("${sentinel.metrics.snapshot.up-steady-interval-seconds:300}")
    private long upSteadyIntervalSeconds;

    @Value("${sentinel.metrics.snapshot.up-change-interval-seconds:90}")
    private long upChangeIntervalSeconds;

    @Value("${sentinel.metrics.snapshot.incident-interval-seconds:20}")
    private long incidentIntervalSeconds;

    @Value("${sentinel.metrics.snapshot.max-silent-interval-seconds:900}")
    private long maxSilentIntervalSeconds;

    @Value("${sentinel.metrics.snapshot.delta.cpu:2.0}")
    private double cpuDeltaThreshold;

    @Value("${sentinel.metrics.snapshot.delta.memory:2.0}")
    private double memoryDeltaThreshold;

    @Value("${sentinel.metrics.snapshot.delta.disk:1.0}")
    private double diskDeltaThreshold;

    @Value("${sentinel.metrics.snapshot.delta.network-in:1024.0}")
    private double networkInDeltaThreshold;

    @Value("${sentinel.metrics.snapshot.delta.network-out:1024.0}")
    private double networkOutDeltaThreshold;

    /**
     * Compatibility entry-point. Uses adaptive write policy defaults.
     */
    public MetricsSnapshot captureMonitoringSnapshot(InstanceEntity instance, Map<String, Object> metrics) {
        boolean healthy = Boolean.TRUE.equals(metrics.get("healthy"));
        return captureMonitoringSnapshot(instance, metrics, healthy, false, false);
    }

    /**
     * Saves snapshots using adaptive write frequency and delta-based deduplication.
     */
    public MetricsSnapshot captureMonitoringSnapshot(
            InstanceEntity instance,
            Map<String, Object> metrics,
            boolean healthy,
            boolean stateChanged,
            boolean anomalyLifecycleChanged
    ) {
        LocalDateTime now = LocalDateTime.now();
        boolean isValid = Boolean.TRUE.equals(metrics.get("isValid"));
        String reason = valueAsString(metrics.get("reason"));
        String error = valueAsString(metrics.get("error"));

        Double cpu = parseNullableDouble(metrics.get("cpu"));
        Double memory = parseNullableDouble(metrics.get("memory"));
        Double disk = parseNullableDouble(metrics.get("disk"));
        Double networkIn = parseNullableDouble(metrics.get("networkIn"));
        Double networkOut = parseNullableDouble(metrics.get("networkOut"));

        String currentState = instance.getState() != null ? instance.getState().name() : null;
        double currentStateCode = mapStateToCode(currentState);
        Optional<MetricsSnapshot> previous = snapshotRepository
                .findTopByInstanceEntity_InstanceIdOrderByCollectedAtDesc(instance.getInstanceId());

        if (!shouldPersist(
                previous.orElse(null),
                now,
                healthy,
                isValid,
                stateChanged,
                anomalyLifecycleChanged,
                cpu,
                memory,
                disk,
                networkIn,
                networkOut,
                currentStateCode,
                reason,
                error
        )) {
            log.debug("Metrics snapshot skipped for {} (healthy={}, valid={}, stateChanged={}, anomalyChanged={})",
                    instance.getInstanceId(), healthy, isValid, stateChanged, anomalyLifecycleChanged);
            return previous.orElse(null);
        }

        MetricsSnapshot snapshot = MetricsSnapshot.builder()
                .instanceEntity(instance)
                .snapshotTime(now)
                .collectedAt(now)
                .errorTime(isValid ? null : now)
                .errorType(isValid ? null : "METRICS_UNAVAILABLE")
                .errorMessage(isValid ? null : (reason != null ? reason : error))
                .cpuUsage(cpu)
                .memoryUsage(memory)
                .diskUsage(disk)
                .diskIops(disk) // Keep legacy column populated for compatibility.
                .networkIn(networkIn)
                .networkOut(networkOut)
                .instanceState(currentStateCode)
                .isValid(isValid)
                .timeSeriesJson(null)
                .aiContext(null)
                .aiAnalysis(null)
                .grafanaSnapshotUrl(null)
                .shareableUrl(null)
                .build();

        MetricsSnapshot saved = snapshotRepository.save(snapshot);
        log.debug("Metrics snapshot saved for {} (valid={})", instance.getInstanceId(), isValid);
        return saved;
    }

    /**
     * Legacy compatibility method used by older paths. It now still stores nullable metrics and validity.
     */
    public void captureSnapshot(InstanceEntity instance, String errorType, String errorMessage) {
        Map<String, Object> metrics = prometheusService.getAllMetrics(instance.getInstanceId(), instance.getState());
        if (errorType != null) {
            metrics.putIfAbsent("errorType", errorType);
        }
        if (errorMessage != null) {
            metrics.putIfAbsent("reason", errorMessage);
        }
        boolean healthy = Boolean.TRUE.equals(metrics.get("healthy"));
        captureMonitoringSnapshot(instance, metrics, healthy, false, false);
    }

    public Optional<Long> findLatestValidSnapshotId(String instanceId) {
        return snapshotRepository
                .findTopByInstanceEntity_InstanceIdAndIsValidTrueOrderByCollectedAtDesc(instanceId)
                .map(MetricsSnapshot::getId);
    }

    private Double parseNullableDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        String raw = value.toString().trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String valueAsString(Object value) {
        return value == null ? null : value.toString();
    }

    private boolean shouldPersist(
            MetricsSnapshot previous,
            LocalDateTime now,
            boolean healthy,
            boolean isValid,
            boolean stateChanged,
            boolean anomalyLifecycleChanged,
            Double cpu,
            Double memory,
            Double disk,
            Double networkIn,
            Double networkOut,
            double currentStateCode,
            String reason,
            String error
    ) {
        if (previous == null) {
            return true;
        }
        if (stateChanged || anomalyLifecycleChanged) {
            return true;
        }

        long elapsedSeconds = secondsBetween(previous, now);
        if (elapsedSeconds >= maxSilentIntervalSeconds) {
            return true;
        }

        boolean incidentContext = !healthy
                || !isValid
                || !isUpState(currentStateCode);
        if (incidentContext) {
            return elapsedSeconds >= incidentIntervalSeconds;
        }

        boolean statusChanged = hasStatusChange(previous, isValid, currentStateCode, reason, error);
        boolean significantDelta = hasSignificantMetricDelta(previous, cpu, memory, disk, networkIn, networkOut);
        if (statusChanged || significantDelta) {
            return elapsedSeconds >= upChangeIntervalSeconds;
        }
        return elapsedSeconds >= upSteadyIntervalSeconds;
    }

    private long secondsBetween(MetricsSnapshot previous, LocalDateTime now) {
        LocalDateTime previousTime = previous.getCollectedAt() != null
                ? previous.getCollectedAt()
                : previous.getSnapshotTime();
        if (previousTime == null) {
            return Long.MAX_VALUE;
        }
        return Math.max(0, Duration.between(previousTime, now).getSeconds());
    }

    private boolean hasStatusChange(
            MetricsSnapshot previous,
            boolean isValid,
            double currentStateCode,
            String reason,
            String error
    ) {
        boolean previousValid = Boolean.TRUE.equals(previous.getIsValid());
        if (previousValid != isValid) {
            return true;
        }

        Double previousStateCode = previous.getInstanceState();
        if (previousStateCode == null || Double.compare(previousStateCode, currentStateCode) != 0) {
            return true;
        }

        if (!isValid) {
            String previousError = valueAsString(previous.getErrorMessage());
            String currentError = reason != null ? reason : error;
            return !equalsNullable(previousError, currentError);
        }

        return false;
    }

    private boolean hasSignificantMetricDelta(
            MetricsSnapshot previous,
            Double cpu,
            Double memory,
            Double disk,
            Double networkIn,
            Double networkOut
    ) {
        return deltaReached(previous.getCpuUsage(), cpu, cpuDeltaThreshold)
                || deltaReached(previous.getMemoryUsage(), memory, memoryDeltaThreshold)
                || deltaReached(previous.getDiskUsage(), disk, diskDeltaThreshold)
                || deltaReached(previous.getNetworkIn(), networkIn, networkInDeltaThreshold)
                || deltaReached(previous.getNetworkOut(), networkOut, networkOutDeltaThreshold);
    }

    private boolean deltaReached(Double oldValue, Double newValue, double threshold) {
        if (oldValue == null && newValue == null) {
            return false;
        }
        if (oldValue == null || newValue == null) {
            return true;
        }
        return Math.abs(newValue - oldValue) >= threshold;
    }

    private boolean equalsNullable(String left, String right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.equals(right);
    }

    private boolean isUpState(double stateCode) {
        return Double.compare(stateCode, mapStateToCode(MonitorState.UP.name())) == 0;
    }

    private int mapStateToCode(String state) {
        if (state == null) {
            return 0;
        }
        return switch (state) {
            case "UP" -> 1;
            case "SUSPECT" -> 2;
            case "QUARANTINED" -> 3;
            case "TERMINATED" -> 4;
            case "RECOVERED" -> 5;
            default -> 0;
        };
    }
}
