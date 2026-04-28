package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.*;
import com.sentinal.registry.repository.MetricAnomalyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
@RequiredArgsConstructor
public class MetricAnomalyService {

    private final MetricAnomalyRepository anomalyRepository;
    private final MetricsSnapshotService snapshotService;
    private final MetricLifecycleSnapshotService lifecycleSnapshotService;
    private final Map<String, TrendState> trendStates = new ConcurrentHashMap<>();

    @Value("${sentinel.metrics.anomaly.sudden-spike-percent:20.0}")
    private double suddenSpikePercent;

    @Value("${sentinel.metrics.anomaly.spike-snapshot-interval-seconds:60}")
    private long spikeSnapshotIntervalSeconds;

    public DetectionResult processMetrics(
            InstanceEntity instance,
            Map<String, Object> metrics,
            LatestMetrics previousLatest,
            IncidentSnapshot activeIncident
    ) {
        if (!Boolean.TRUE.equals(metrics.get("isValid"))) {
            return DetectionResult.none();
        }

        DetectionResult merged = DetectionResult.none();
        merged = merged.merge(handleMetric(instance, metrics, previousLatest, activeIncident, MetricName.CPU, "cpu", 90.0));
        merged = merged.merge(handleMetric(instance, metrics, previousLatest, activeIncident, MetricName.MEMORY, "memory", 85.0));
        merged = merged.merge(handleMetric(instance, metrics, previousLatest, activeIncident, MetricName.DISK, "disk", 90.0));
        return merged;
    }

    private DetectionResult handleMetric(
            InstanceEntity instance,
            Map<String, Object> metrics,
            LatestMetrics previousLatest,
            IncidentSnapshot activeIncident,
            MetricName metricName,
            String metricKey,
            double threshold
    ) {
        Double currentValue = parseNullableDouble(metrics.get(metricKey));
        Double baselineValue = baselineValue(previousLatest, metricName);
        if (currentValue == null) {
            return DetectionResult.none();
        }

        double spikePercent = computeSpikePercentage(baselineValue, currentValue);
        boolean thresholdBreach = currentValue > threshold;
        boolean suddenSpike = spikePercent >= suddenSpikePercent
                && isOperationallySignificantSpike(metricName, baselineValue, currentValue);
        TrendState trendState = updateTrendState(instance, metricName, baselineValue, currentValue);
        boolean sustainedClimb = isSustainedClimb(metricName, trendState, currentValue);
        boolean abnormal = thresholdBreach || suddenSpike || sustainedClimb;
        LocalDateTime now = LocalDateTime.now();

        MetricAnomaly active = anomalyRepository
                .findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                        instance.getId(),
                        metricName,
                        AnomalyStatus.ACTIVE
                )
                .orElse(null);

        if (active == null) {
            if (!abnormal) {
                return DetectionResult.none();
            }

            Double anomalyBaseline = sustainedClimb && trendState != null && trendState.baselineValue() != null
                    ? trendState.baselineValue()
                    : baselineValue;
            double anomalySpikePercent = computeSpikePercentage(anomalyBaseline, currentValue);

            MetricAnomaly anomaly = MetricAnomaly.builder()
                    .instanceEntity(instance)
                    .metricName(metricName)
                    .status(AnomalyStatus.ACTIVE)
                    .triggerType(resolveTriggerType(thresholdBreach, suddenSpike, sustainedClimb))
                    .severity(resolveSeverity(currentValue, threshold))
                    .baselineValue(anomalyBaseline)
                    .startValue(currentValue)
                    .currentValue(currentValue)
                    .peakValue(currentValue)
                    .threshold(threshold)
                    .spikePercentage(anomalySpikePercent > 0 ? anomalySpikePercent : null)
                    .instanceState(instance.getState())
                    .message(buildMessage(metricName, currentValue, threshold, instance.getState() != null ? instance.getState().name() : "UNKNOWN"))
                    .metricValue(currentValue)
                    .createdAt(now)
                    .startedAt(now)
                    .lastSeenAt(now)
                    .resolvedAt(null)
                    .build();
            anomaly = anomalyRepository.save(anomaly);

            LatestMetrics preSpikeBaseline = baselineMetricsForSnapshot(previousLatest, metricName, anomalyBaseline);
            MetricsSnapshot pre = snapshotService.savePreSpikeSnapshot(
                    instance,
                    preSpikeBaseline,
                    "Pre-spike baseline for " + metricName.name(),
                    anomaly,
                    activeIncident
            );
            MetricsSnapshot start = snapshotService.saveEventSnapshot(
                    instance,
                    MetricSnapshotType.SPIKE_START,
                    metrics,
                    metricName.name() + " spike started",
                    anomaly,
                    activeIncident
            );

            anomaly.setPreSpikeSnapshotId(pre != null ? pre.getId() : null);
            anomaly.setStartSnapshotId(start != null ? start.getId() : null);
            anomalyRepository.save(anomaly);
            lifecycleSnapshotService.recordSpikePoint(
                    instance,
                    anomaly,
                    metrics,
                    buildMessage(metricName, currentValue, threshold, instance.getState() != null ? instance.getState().name() : "UNKNOWN")
            );
            return DetectionResult.lifecycle(anomaly.getId());
        }

        abnormal = abnormal || isActiveAnomalyStillUnstable(active, metricName, currentValue);

        if (abnormal) {
            LocalDateTime lastSeenBefore = active.getLastSeenAt();
            active.setStatus(AnomalyStatus.ACTIVE);
            active.setCurrentValue(currentValue);
            active.setMetricValue(currentValue);
            active.setLastSeenAt(now);
            active.setInstanceState(instance.getState());
            active.setSeverity(resolveSeverity(currentValue, threshold));
            if (thresholdBreach) {
                active.setTriggerType(AnomalyTriggerType.THRESHOLD_BREACH);
            } else if (sustainedClimb && active.getTriggerType() != AnomalyTriggerType.THRESHOLD_BREACH) {
                active.setTriggerType(AnomalyTriggerType.SUSTAINED_SPIKE);
            }
            double activeSpikePercent = computeSpikePercentage(active.getBaselineValue(), currentValue);
            Double resolvedSpikePercent;
            if (activeSpikePercent > 0) {
                resolvedSpikePercent = activeSpikePercent;
            } else {
                resolvedSpikePercent = active.getSpikePercentage();
            }
            active.setSpikePercentage(resolvedSpikePercent);

            boolean newPeak = active.getPeakValue() == null || currentValue > active.getPeakValue();
            if (newPeak) {
                active.setPeakValue(currentValue);
                MetricsSnapshot peak = snapshotService.saveEventSnapshot(
                        instance,
                        MetricSnapshotType.PEAK,
                        metrics,
                        metricName.name() + " new peak observed",
                        active,
                        activeIncident
                );
                active.setPeakSnapshotId(peak != null ? peak.getId() : active.getPeakSnapshotId());
            } else if (shouldPersistSpikePoint(lastSeenBefore, now)) {
                snapshotService.saveEventSnapshot(
                        instance,
                        MetricSnapshotType.SPIKE,
                        metrics,
                        metricName.name() + " sustained spike",
                        active,
                        activeIncident
                );
            }

            anomalyRepository.save(active);
            lifecycleSnapshotService.recordSpikePoint(
                    instance,
                    active,
                    metrics,
                    buildMessage(metricName, currentValue, threshold, instance.getState() != null ? instance.getState().name() : "UNKNOWN")
            );
            return DetectionResult.withUpdate();
        }

        MetricsSnapshot recovery = snapshotService.saveEventSnapshot(
                instance,
                MetricSnapshotType.RECOVERY,
                metrics,
                metricName.name() + " recovered to normal",
                active,
                activeIncident
        );
        active.setStatus(AnomalyStatus.RESOLVED);
        active.setCurrentValue(currentValue);
        active.setMetricValue(currentValue);
        active.setRecoverySnapshotId(recovery != null ? recovery.getId() : null);
        active.setResolvedAt(now);
        active.setLastSeenAt(now);
        anomalyRepository.save(active);
        lifecycleSnapshotService.recordRecoveryPoint(
                instance,
                active,
                metrics,
                metricName.name() + " recovered to stable range"
        );
        resetTrendState(instance, metricName, currentValue);
        return DetectionResult.lifecycle(active.getId());
    }

    private AnomalyTriggerType resolveTriggerType(boolean thresholdBreach, boolean suddenSpike, boolean sustainedClimb) {
        if (thresholdBreach) {
            return AnomalyTriggerType.THRESHOLD_BREACH;
        }
        if (sustainedClimb) {
            return AnomalyTriggerType.SUSTAINED_SPIKE;
        }
        if (suddenSpike) {
            return AnomalyTriggerType.SUDDEN_SPIKE;
        }
        return AnomalyTriggerType.SUSTAINED_SPIKE;
    }

    private boolean shouldPersistSpikePoint(LocalDateTime lastSeenAt, LocalDateTime now) {
        if (lastSeenAt == null) {
            return true;
        }
        return Duration.between(lastSeenAt, now).getSeconds() >= spikeSnapshotIntervalSeconds;
    }

    private Double baselineValue(LatestMetrics latestMetrics, MetricName metricName) {
        if (latestMetrics == null || !Boolean.TRUE.equals(latestMetrics.getIsValid())) {
            return null;
        }
        return switch (metricName) {
            case CPU -> latestMetrics.getCpuUsage();
            case MEMORY -> latestMetrics.getMemoryUsage();
            case DISK -> latestMetrics.getDiskUsage();
            case DISK_IOPS -> latestMetrics.getDiskIops();
            case NETWORK_IN -> latestMetrics.getNetworkIn();
            case NETWORK_OUT -> latestMetrics.getNetworkOut();
        };
    }

    private LatestMetrics baselineMetricsForSnapshot(LatestMetrics previousLatest, MetricName metricName, Double anomalyBaseline) {
        if (previousLatest == null || !Boolean.TRUE.equals(previousLatest.getIsValid()) || anomalyBaseline == null) {
            return previousLatest;
        }

        LatestMetrics baseline = LatestMetrics.builder()
                .isValid(true)
                .cpuUsage(previousLatest.getCpuUsage())
                .memoryUsage(previousLatest.getMemoryUsage())
                .diskUsage(previousLatest.getDiskUsage())
                .diskIops(previousLatest.getDiskIops())
                .networkIn(previousLatest.getNetworkIn())
                .networkOut(previousLatest.getNetworkOut())
                .collectedAt(previousLatest.getCollectedAt())
                .updatedAt(previousLatest.getUpdatedAt())
                .build();

        switch (metricName) {
            case CPU -> baseline.setCpuUsage(anomalyBaseline);
            case MEMORY -> baseline.setMemoryUsage(anomalyBaseline);
            case DISK -> baseline.setDiskUsage(anomalyBaseline);
            case DISK_IOPS -> baseline.setDiskIops(anomalyBaseline);
            case NETWORK_IN -> baseline.setNetworkIn(anomalyBaseline);
            case NETWORK_OUT -> baseline.setNetworkOut(anomalyBaseline);
        }
        return baseline;
    }

    private double computeSpikePercentage(Double baseline, Double current) {
        if (baseline == null || current == null || baseline <= 0) {
            return 0.0;
        }
        return ((current - baseline) / baseline) * 100.0;
    }

    private boolean isOperationallySignificantSpike(MetricName metricName, Double baseline, Double current) {
        if (baseline == null || current == null || current <= baseline) {
            return false;
        }

        double absoluteDelta = current - baseline;
        return switch (metricName) {
            case CPU -> current >= 25.0 && absoluteDelta >= 10.0;
            case MEMORY -> current >= 70.0 && absoluteDelta >= 10.0;
            case DISK -> current >= 80.0 && absoluteDelta >= 5.0;
            case DISK_IOPS, NETWORK_IN, NETWORK_OUT -> absoluteDelta >= 20.0;
        };
    }

    private TrendState updateTrendState(
            InstanceEntity instance,
            MetricName metricName,
            Double previousValue,
            Double currentValue
    ) {
        String key = trendKey(instance, metricName);
        if (currentValue == null) {
            trendStates.remove(key);
            return null;
        }

        TrendState previousState = trendStates.get(key);
        double baseline = previousState != null && previousState.baselineValue() != null
                ? previousState.baselineValue()
                : previousValue != null ? previousValue : currentValue;
        double lastValue = previousState != null && previousState.lastValue() != null
                ? previousState.lastValue()
                : previousValue != null ? previousValue : currentValue;

        boolean rising = currentValue > lastValue + trendNoiseTolerance(metricName);
        boolean fallingOrFlat = currentValue <= lastValue + trendNoiseTolerance(metricName);
        TrendState next;
        if (rising) {
            int risingChecks = previousState != null ? previousState.risingChecks() + 1 : 2;
            next = new TrendState(baseline, currentValue, risingChecks, LocalDateTime.now());
        } else if (fallingOrFlat) {
            next = new TrendState(currentValue, currentValue, 1, LocalDateTime.now());
        } else {
            next = new TrendState(baseline, currentValue, previousState != null ? previousState.risingChecks() : 1, LocalDateTime.now());
        }
        trendStates.put(key, next);
        return next;
    }

    private boolean isSustainedClimb(MetricName metricName, TrendState trendState, Double currentValue) {
        if (trendState == null || trendState.baselineValue() == null || currentValue == null) {
            return false;
        }
        double delta = currentValue - trendState.baselineValue();
        if (trendState.risingChecks() < sustainedClimbChecks(metricName)) {
            return false;
        }
        return switch (metricName) {
            case CPU -> currentValue >= 30.0 && delta >= 20.0;
            case MEMORY -> currentValue >= 70.0 && delta >= 15.0;
            case DISK -> currentValue >= 80.0 && delta >= 5.0;
            case DISK_IOPS, NETWORK_IN, NETWORK_OUT -> delta >= 20.0;
        };
    }

    private boolean isActiveAnomalyStillUnstable(MetricAnomaly active, MetricName metricName, Double currentValue) {
        if (active == null || currentValue == null) {
            return false;
        }
        Double baseline = active.getBaselineValue();
        if (baseline == null) {
            return false;
        }
        double delta = currentValue - baseline;
        return switch (metricName) {
            case CPU -> currentValue >= 25.0 && delta >= 10.0;
            case MEMORY -> currentValue >= 65.0 && delta >= 10.0;
            case DISK -> currentValue >= 78.0 && delta >= 3.0;
            case DISK_IOPS, NETWORK_IN, NETWORK_OUT -> delta >= 10.0;
        };
    }

    private int sustainedClimbChecks(MetricName metricName) {
        return switch (metricName) {
            case CPU, MEMORY -> 5;
            case DISK -> 3;
            case DISK_IOPS, NETWORK_IN, NETWORK_OUT -> 3;
        };
    }

    private double trendNoiseTolerance(MetricName metricName) {
        return switch (metricName) {
            case CPU, MEMORY -> 1.0;
            case DISK -> 0.25;
            case DISK_IOPS, NETWORK_IN, NETWORK_OUT -> 1.0;
        };
    }

    private void resetTrendState(InstanceEntity instance, MetricName metricName, Double currentValue) {
        if (currentValue == null) {
            trendStates.remove(trendKey(instance, metricName));
            return;
        }
        trendStates.put(trendKey(instance, metricName), new TrendState(currentValue, currentValue, 1, LocalDateTime.now()));
    }

    private String trendKey(InstanceEntity instance, MetricName metricName) {
        return (instance.getId() != null ? instance.getId() : instance.getInstanceId()) + ":" + metricName.name();
    }

    private String resolveSeverity(double value, double threshold) {
        if (value >= threshold + 15) {
            return "CRITICAL";
        }
        if (value >= threshold + 8) {
            return "HIGH";
        }
        if (value >= threshold + 3) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private String buildMessage(MetricName metricName, double value, double threshold, String state) {
        return String.format(
                "%s anomaly: value=%.2f threshold=%.2f state=%s",
                metricName.name(),
                value,
                threshold,
                state
        );
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

    private record TrendState(Double baselineValue, Double lastValue, int risingChecks, LocalDateTime updatedAt) {
    }

    public record DetectionResult(boolean lifecycleChanged, boolean updated, List<Long> anomalyIds) {
        static DetectionResult none() {
            return new DetectionResult(false, false, List.of());
        }

        static DetectionResult withUpdate() {
            return new DetectionResult(false, true, List.of());
        }

        static DetectionResult lifecycle(Long anomalyId) {
            return new DetectionResult(true, false, anomalyId == null ? List.of() : List.of(anomalyId));
        }

        DetectionResult merge(DetectionResult other) {
            if (other == null) {
                return this;
            }
            List<Long> mergedIds = new ArrayList<>(this.anomalyIds);
            mergedIds.addAll(other.anomalyIds);
            return new DetectionResult(
                    this.lifecycleChanged || other.lifecycleChanged,
                    this.updated || other.updated,
                    mergedIds
            );
        }
    }
}
