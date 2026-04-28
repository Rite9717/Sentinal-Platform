package com.sentinal.registry.service.metrics;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.AnomalyStatus;
import com.sentinal.registry.model.snapshot.IncidentLifecycleStatus;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.MetricAnomaly;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class MetricLifecycleSnapshotService {

    private static final int MAX_METRIC_POINTS_PER_SNAPSHOT = 10;
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE_TIME;

    private final IncidentSnapshotRepository incidentRepository;
    private final MetricSnapshotRepository metricSnapshotRepository;
    private final ObjectMapper objectMapper;

    public void recordSpikePoint(
            InstanceEntity instance,
            MetricAnomaly anomaly,
            Map<String, Object> metrics,
            String triggerReason
    ) {
        if (instance == null || anomaly == null || anomaly.getId() == null || !Boolean.TRUE.equals(metrics.get("isValid"))) {
            return;
        }

        IncidentSnapshot snapshot = incidentRepository
                .findFirstBySourceAnomalyIdAndIncidentStatusOrderByStartedAtDesc(
                        anomaly.getId(),
                        IncidentLifecycleStatus.ACTIVE
                )
                .orElse(null);

        if (snapshot != null && safeCount(snapshot) >= MAX_METRIC_POINTS_PER_SNAPSHOT) {
            closeSnapshot(snapshot, instance.getState(), "Metric lifecycle segment reached 10 samples");
            snapshot.setAiContext(toJson(buildAiSnapshot(instance, anomaly, metrics, snapshot)));
            incidentRepository.save(snapshot);
            snapshot = null;
        }

        if (snapshot == null) {
            snapshot = createSnapshot(instance, anomaly, triggerReason);
        }

        appendPoint(snapshot, instance, anomaly, metrics, false);
    }

    public void recordRecoveryPoint(
            InstanceEntity instance,
            MetricAnomaly anomaly,
            Map<String, Object> metrics,
            String triggerReason
    ) {
        if (instance == null || anomaly == null || anomaly.getId() == null || !Boolean.TRUE.equals(metrics.get("isValid"))) {
            return;
        }

        IncidentSnapshot snapshot = incidentRepository
                .findFirstBySourceAnomalyIdAndIncidentStatusOrderByStartedAtDesc(
                        anomaly.getId(),
                        IncidentLifecycleStatus.ACTIVE
                )
                .orElseGet(() -> createSnapshot(instance, anomaly, triggerReason));

        appendPoint(snapshot, instance, anomaly, metrics, true);
        closeSnapshot(snapshot, MonitorState.UP, triggerReason);
        snapshot.setAiContext(toJson(buildAiSnapshot(instance, anomaly, metrics, snapshot)));
        incidentRepository.save(snapshot);
    }

    private IncidentSnapshot createSnapshot(InstanceEntity instance, MetricAnomaly anomaly, String triggerReason) {
        LocalDateTime now = LocalDateTime.now();
        IncidentSnapshot snapshot = IncidentSnapshot.builder()
                .instanceEntity(instance)
                .incidentStatus(IncidentLifecycleStatus.ACTIVE)
                .sourceAnomalyId(anomaly.getId())
                .metricSampleCount(0)
                .status(instance.getState())
                .startState(instance.getState())
                .finalState(null)
                .severity(anomaly.getSeverity())
                .startedAt(now)
                .resolvedAt(null)
                .stateTransition("METRIC_STABLE -> " + metricName(anomaly) + "_UNSTABLE")
                .triggerReason(triggerReason)
                .lastGoodSnapshotId(anomaly.getPreSpikeSnapshotId())
                .resolution(null)
                .metricsTimeline("[]")
                .aiContext("{}")
                .build();
        return incidentRepository.save(snapshot);
    }

    private void appendPoint(
            IncidentSnapshot snapshot,
            InstanceEntity instance,
            MetricAnomaly anomaly,
            Map<String, Object> metrics,
            boolean recovery
    ) {
        int nextCount = safeCount(snapshot) + 1;
        snapshot.setMetricSampleCount(nextCount);
        snapshot.setStatus(instance.getState());
        snapshot.setSeverity(anomaly.getSeverity());
        snapshot.setTriggerReason(recovery
                ? metricName(anomaly) + " recovered to stable range"
                : metricName(anomaly) + " remains unstable");
        snapshot.setMetricsTimeline(appendTimeline(snapshot.getMetricsTimeline(), anomaly, metrics, recovery));
        snapshot.setAiContext(toJson(buildAiSnapshot(instance, anomaly, metrics, snapshot)));
        incidentRepository.save(snapshot);
    }

    private void closeSnapshot(IncidentSnapshot snapshot, MonitorState finalState, String reason) {
        snapshot.setIncidentStatus(IncidentLifecycleStatus.RESOLVED);
        snapshot.setFinalState(finalState);
        snapshot.setResolution(finalState);
        snapshot.setResolvedAt(LocalDateTime.now());
        snapshot.setTriggerReason(reason);
        incidentRepository.save(snapshot);
    }

    private Map<String, Object> buildAiSnapshot(
            InstanceEntity instance,
            MetricAnomaly anomaly,
            Map<String, Object> metrics,
            IncidentSnapshot incident
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        Map<String, Object> instancePayload = new LinkedHashMap<>();
        instancePayload.put("instanceId", instance.getInstanceId());
        instancePayload.put("state", instance.getState() != null ? instance.getState().name() : null);
        instancePayload.put("region", instance.getRegion());
        payload.put("instance", instancePayload);

        Map<String, Object> latestMetrics = new LinkedHashMap<>();
        latestMetrics.put("cpuUsage", parseNullableDouble(metrics.get("cpu")));
        latestMetrics.put("memoryUsage", parseNullableDouble(metrics.get("memory")));
        latestMetrics.put("diskUsage", parseNullableDouble(metrics.get("disk")));
        latestMetrics.put("isValid", Boolean.TRUE.equals(metrics.get("isValid")));
        latestMetrics.put("collectedAt", FORMATTER.format(LocalDateTime.now()));
        payload.put("latestMetrics", latestMetrics);

        payload.put("activeAnomalies", List.of(buildAnomalyPayload(anomaly)));

        Map<String, Object> activeIncident = new LinkedHashMap<>();
        activeIncident.put("status", incident.getIncidentStatus() != null ? incident.getIncidentStatus().name() : null);
        activeIncident.put("startState", incident.getStartState() != null ? incident.getStartState().name() : null);
        activeIncident.put("triggerReason", incident.getTriggerReason());
        activeIncident.put("startedAt", format(incident.getStartedAt()));
        payload.put("activeIncident", activeIncident);

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", anomaly.getStatus() == AnomalyStatus.RESOLVED ? "RECOVERED" : "ANOMALY_LINKED");
        event.put("message", incident.getTriggerReason());
        event.put("createdAt", FORMATTER.format(LocalDateTime.now()));
        payload.put("incidentEvents", List.of(event));

        return payload;
    }

    private Map<String, Object> buildAnomalyPayload(MetricAnomaly anomaly) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("metricName", metricName(anomaly));
        mapped.put("status", anomaly.getStatus() != null ? anomaly.getStatus().name() : null);
        mapped.put("triggerType", anomaly.getTriggerType() != null ? anomaly.getTriggerType().name() : null);
        mapped.put("baselineValue", anomaly.getBaselineValue());
        mapped.put("startValue", anomaly.getStartValue());
        mapped.put("currentValue", anomaly.getCurrentValue());
        mapped.put("peakValue", anomaly.getPeakValue());
        mapped.put("spikePercentage", anomaly.getSpikePercentage());
        mapped.put("startedAt", format(anomaly.getStartedAt()));
        mapped.put("durationMinutes", durationMinutes(anomaly.getStartedAt(), anomaly.getResolvedAt()));
        mapped.put("snapshots", metricSnapshotRepository.findByAnomaly_IdOrderByCollectedAtAsc(anomaly.getId())
                .stream()
                .map(this::mapMetricSnapshot)
                .toList());
        return mapped;
    }

    private Map<String, Object> mapMetricSnapshot(MetricsSnapshot snapshot) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("type", snapshot.getSnapshotType() != null ? snapshot.getSnapshotType().name() : null);
        mapped.put("cpuUsage", snapshot.getCpuUsage());
        mapped.put("memoryUsage", snapshot.getMemoryUsage());
        mapped.put("diskUsage", snapshot.getDiskUsage());
        mapped.put("collectedAt", format(snapshot.getCollectedAt()));
        return mapped;
    }

    private String appendTimeline(String existingTimeline, MetricAnomaly anomaly, Map<String, Object> metrics, boolean recovery) {
        List<Map<String, Object>> timeline = parseTimeline(existingTimeline);
        Map<String, Object> point = new LinkedHashMap<>();
        point.put("type", recovery ? "RECOVERY" : "SPIKE");
        point.put("metricName", metricName(anomaly));
        point.put("cpuUsage", parseNullableDouble(metrics.get("cpu")));
        point.put("memoryUsage", parseNullableDouble(metrics.get("memory")));
        point.put("diskUsage", parseNullableDouble(metrics.get("disk")));
        point.put("collectedAt", FORMATTER.format(LocalDateTime.now()));
        timeline.add(point);
        return toJson(timeline);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseTimeline(String timeline) {
        if (timeline == null || timeline.isBlank()) {
            return new java.util.ArrayList<>();
        }
        try {
            return new java.util.ArrayList<>(objectMapper.readValue(timeline, List.class));
        } catch (Exception ignored) {
            return new java.util.ArrayList<>();
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Could not serialize metric lifecycle snapshot: {}", e.getMessage());
            return "{}";
        }
    }

    private int safeCount(IncidentSnapshot snapshot) {
        return snapshot.getMetricSampleCount() != null ? snapshot.getMetricSampleCount() : 0;
    }

    private String metricName(MetricAnomaly anomaly) {
        return anomaly.getMetricName() != null ? anomaly.getMetricName().name() : "METRIC";
    }

    private String format(LocalDateTime value) {
        return value != null ? FORMATTER.format(value) : null;
    }

    private Long durationMinutes(LocalDateTime start, LocalDateTime resolved) {
        if (start == null) {
            return null;
        }
        LocalDateTime end = resolved != null ? resolved : LocalDateTime.now();
        return Math.max(Duration.between(start, end).toMinutes(), 0L);
    }

    private Double parseNullableDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        try {
            return Double.parseDouble(value.toString().trim());
        } catch (Exception ignored) {
            return null;
        }
    }
}
