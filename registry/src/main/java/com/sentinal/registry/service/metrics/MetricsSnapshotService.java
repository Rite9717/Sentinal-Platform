package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.*;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class MetricsSnapshotService {

    private static final List<MetricSnapshotType> MEANINGFUL_TYPES = List.of(
            MetricSnapshotType.PRE_SPIKE,
            MetricSnapshotType.SPIKE_START,
            MetricSnapshotType.SPIKE,
            MetricSnapshotType.PEAK,
            MetricSnapshotType.RECOVERY,
            MetricSnapshotType.STATE_CHANGE,
            MetricSnapshotType.BASELINE
    );

    private final MetricSnapshotRepository snapshotRepository;

    public Optional<Long> findLatestValidSnapshotId(Long instanceId) {
        return findLatestMeaningfulSnapshot(instanceId)
                .or(() -> snapshotRepository.findTopByInstanceEntity_IdAndIsValidTrueOrderByCollectedAtDesc(instanceId))
                .map(MetricsSnapshot::getId);
    }

    public Optional<MetricsSnapshot> findLatestValidSnapshot(Long instanceId) {
        return snapshotRepository.findTopByInstanceEntity_IdAndIsValidTrueOrderByCollectedAtDesc(instanceId);
    }

    public List<MetricsSnapshot> findRecentSnapshots(Long instanceId, int limit) {
        List<MetricsSnapshot> snapshots = snapshotRepository.findTop20ByInstanceEntity_IdOrderByCollectedAtDesc(instanceId);
        return snapshots.size() <= limit ? snapshots : snapshots.subList(0, limit);
    }

    public Optional<MetricsSnapshot> findLatestMeaningfulSnapshot(Long instanceId) {
        return snapshotRepository
                .findTopByInstanceEntity_IdAndIsValidTrueAndSnapshotTypeInOrderByCollectedAtDesc(instanceId, MEANINGFUL_TYPES);
    }

    public MetricsSnapshot saveStateChangeSnapshot(
            InstanceEntity instance,
            Map<String, Object> metrics,
            String note,
            IncidentSnapshot incident
    ) {
        if (!Boolean.TRUE.equals(metrics.get("isValid"))) {
            return null;
        }
        return saveEventSnapshot(
                instance,
                MetricSnapshotType.STATE_CHANGE,
                metrics,
                note,
                null,
                incident
        );
    }

    public MetricsSnapshot savePreSpikeSnapshot(
            InstanceEntity instance,
            LatestMetrics baselineMetrics,
            String note,
            MetricAnomaly anomaly,
            IncidentSnapshot incident
    ) {
        if (baselineMetrics == null || !Boolean.TRUE.equals(baselineMetrics.getIsValid())) {
            return null;
        }
        LocalDateTime now = LocalDateTime.now();
        MetricsSnapshot snapshot = MetricsSnapshot.builder()
                .instanceEntity(instance)
                .anomaly(anomaly)
                .incident(incident)
                .snapshotType(MetricSnapshotType.PRE_SPIKE)
                .cpuUsage(baselineMetrics.getCpuUsage())
                .memoryUsage(baselineMetrics.getMemoryUsage())
                .diskUsage(baselineMetrics.getDiskUsage())
                .diskIops(baselineMetrics.getDiskIops())
                .networkIn(baselineMetrics.getNetworkIn())
                .networkOut(baselineMetrics.getNetworkOut())
                .instanceStateLabel(instance.getState() != null ? instance.getState().name() : null)
                .isValid(Boolean.TRUE)
                .collectedAt(now)
                .snapshotTime(now)
                .note(note)
                .build();
        return snapshotRepository.save(snapshot);
    }

    public MetricsSnapshot saveEventSnapshot(
            InstanceEntity instance,
            MetricSnapshotType snapshotType,
            Map<String, Object> metrics,
            String note,
            MetricAnomaly anomaly,
            IncidentSnapshot incident
    ) {
        LocalDateTime now = LocalDateTime.now();
        boolean isValid = Boolean.TRUE.equals(metrics.get("isValid"));

        MetricsSnapshot snapshot = MetricsSnapshot.builder()
                .instanceEntity(instance)
                .anomaly(anomaly)
                .incident(incident)
                .snapshotType(snapshotType)
                .cpuUsage(parseNullableDouble(metrics.get("cpu")))
                .memoryUsage(parseNullableDouble(metrics.get("memory")))
                .diskUsage(parseNullableDouble(metrics.get("disk")))
                .diskIops(parseNullableDouble(metrics.get("diskIops")))
                .networkIn(parseNullableDouble(metrics.get("networkIn")))
                .networkOut(parseNullableDouble(metrics.get("networkOut")))
                .instanceStateLabel(instance.getState() != null ? instance.getState().name() : null)
                .isValid(isValid)
                .errorType(isValid ? null : valueAsString(metrics.get("errorType")))
                .errorMessage(isValid ? null : resolveError(metrics))
                .collectedAt(now)
                .snapshotTime(now)
                .note(note)
                .build();

        return snapshotRepository.save(snapshot);
    }

    private String resolveError(Map<String, Object> metrics) {
        String reason = valueAsString(metrics.get("reason"));
        if (reason != null && !reason.isBlank()) {
            return reason;
        }
        return valueAsString(metrics.get("error"));
    }

    private String valueAsString(Object value) {
        return value == null ? null : value.toString();
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
}
