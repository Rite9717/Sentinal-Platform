package com.sentinal.registry.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.LatestMetrics;
import com.sentinal.registry.model.snapshot.MetricAnomaly;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.repository.MetricAnomalyRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/agent/tools")
@RequiredArgsConstructor
public class AgentToolsController {

    private final InstanceRepository instanceRepository;
    private final IncidentSnapshotRepository incidentRepository;
    private final MetricAnomalyRepository anomalyRepository;
    private final MetricSnapshotRepository metricSnapshotRepository;
    private final ObjectMapper objectMapper;

    @Value("${sentinel.ai.tools.token:}")
    private String toolsToken;

    @GetMapping("/instances/{instanceId}")
    public ResponseEntity<?> getInstance(@PathVariable String instanceId,@RequestHeader(value = "X-Sentinal-AI-Token", required = false) String token)
    {
        if (!authorized(token))
        {
            return unauthorized();
        }
        return instanceRepository.findByInstanceId(instanceId)
                .<ResponseEntity<?>>map(instance -> ResponseEntity.ok(mapInstance(instance)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/instances/{instanceId}/latest-metrics")
    public ResponseEntity<?> getLatestMetrics(
            @PathVariable String instanceId,
            @RequestHeader(value = "X-Sentinal-AI-Token", required = false) String token
    ) {
        if (!authorized(token)) {
            return unauthorized();
        }
        return resolveInstance(instanceId)
                .map(instance -> instanceRepository.findLatestMetricsByInstanceEntityId(instance.getId())
                        .<ResponseEntity<?>>map(metrics -> ResponseEntity.ok(mapLatestMetrics(metrics)))
                        .orElse(ResponseEntity.noContent().build()))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/instances/{instanceId}/snapshots/{snapshotId}")
    public ResponseEntity<?> getSnapshot(
            @PathVariable String instanceId,
            @PathVariable Long snapshotId,
            @RequestHeader(value = "X-Sentinal-AI-Token", required = false) String token
    ) {
        if (!authorized(token)) {
            return unauthorized();
        }
        return resolveSnapshot(instanceId, snapshotId)
                .<ResponseEntity<?>>map(snapshot -> ResponseEntity.ok(mapIncidentSnapshot(snapshot, true)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/instances/{instanceId}/snapshots/recent")
    public ResponseEntity<?> getRecentSnapshots(
            @PathVariable String instanceId,
            @RequestHeader(value = "X-Sentinal-AI-Token", required = false) String token
    ) {
        if (!authorized(token)) {
            return unauthorized();
        }
        return resolveInstance(instanceId)
                .map(instance -> ResponseEntity.ok(incidentRepository
                        .findTop20ByInstanceEntity_IdOrderByStartedAtDesc(instance.getId())
                        .stream()
                        .map(snapshot -> mapIncidentSnapshot(snapshot, false))
                        .toList()))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/instances/{instanceId}/anomalies/recent")
    public ResponseEntity<?> getRecentAnomalies(
            @PathVariable String instanceId,
            @RequestHeader(value = "X-Sentinal-AI-Token", required = false) String token
    ) {
        if (!authorized(token)) {
            return unauthorized();
        }
        return resolveInstance(instanceId)
                .map(instance -> ResponseEntity.ok(anomalyRepository
                        .findTop20ByInstanceEntity_IdOrderByStartedAtDesc(instance.getId())
                        .stream()
                        .map(anomaly -> mapAnomaly(anomaly, true))
                        .toList()))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/instances/{instanceId}/anomalies/active")
    public ResponseEntity<?> getActiveAnomalies(@PathVariable String instanceId,@RequestHeader(value = "X-Sentinal-AI-Token", required = false) String token
    ) {
        if (!authorized(token)) {
            return unauthorized();
        }
        return resolveInstance(instanceId)
                .map(instance -> ResponseEntity.ok(anomalyRepository
                        .findActiveByInstanceId(instance.getId())
                        .stream()
                        .map(anomaly -> mapAnomaly(anomaly, true))
                        .toList()))
                .orElse(ResponseEntity.notFound().build());
    }

    private Optional<InstanceEntity> resolveInstance(String instanceId)
    {
        return instanceRepository.findByInstanceId(instanceId);
    }

    private Optional<IncidentSnapshot> resolveSnapshot(String instanceId, Long snapshotId)
    {
        return resolveInstance(instanceId)
                .flatMap(instance -> incidentRepository.findById(snapshotId)
                        .filter(snapshot -> snapshot.getInstanceEntity() != null)
                        .filter(snapshot -> snapshot.getInstanceEntity().getId().equals(instance.getId())));
    }

    private boolean authorized(String token) {
        if (!StringUtils.hasText(toolsToken)) {
            return true;
        }
        return toolsToken.equals(token);
    }

    private ResponseEntity<Map<String, Object>> unauthorized() {
        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Missing or invalid Sentinal AI tool token"));
    }

    private Map<String, Object> mapInstance(InstanceEntity instance) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", instance.getId());
        mapped.put("instanceId", instance.getInstanceId());
        mapped.put("nickname", instance.getNickname());
        mapped.put("region", instance.getRegion());
        mapped.put("state", enumName(instance.getState()));
        mapped.put("lastError", instance.getLastError());
        mapped.put("suspectCount", instance.getSuspectCount());
        mapped.put("quarantineCount", instance.getQuarantineCount());
        mapped.put("maxSuspectStrikes", instance.getMaxSuspectStrikes());
        mapped.put("maxQuarantineCycles", instance.getMaxQuarantineCycles());
        mapped.put("quarantineUntil", instance.getQuarantineUntil());
        mapped.put("quarantineDurationMinutes", instance.getQuarantineDurationMinutes());
        mapped.put("lastCheckedAt", instance.getLastCheckedAt());
        mapped.put("stateChangedAt", instance.getStateChangedAt());
        return mapped;
    }

    private Map<String, Object> mapLatestMetrics(LatestMetrics metrics) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", metrics.getId());
        mapped.put("cpuUsage", metrics.getCpuUsage());
        mapped.put("memoryUsage", metrics.getMemoryUsage());
        mapped.put("diskUsage", metrics.getDiskUsage());
        mapped.put("diskIops", metrics.getDiskIops());
        mapped.put("networkIn", metrics.getNetworkIn());
        mapped.put("networkOut", metrics.getNetworkOut());
        mapped.put("isValid", metrics.getIsValid());
        mapped.put("errorType", metrics.getErrorType());
        mapped.put("errorMessage", metrics.getErrorMessage());
        mapped.put("collectedAt", metrics.getCollectedAt());
        mapped.put("updatedAt", metrics.getUpdatedAt());
        return mapped;
    }

    private Map<String, Object> mapIncidentSnapshot(IncidentSnapshot snapshot, boolean includeContext) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", snapshot.getId());
        mapped.put("instanceId", snapshot.getInstanceEntity() != null ? snapshot.getInstanceEntity().getInstanceId() : null);
        mapped.put("status", enumName(snapshot.getStatus()));
        mapped.put("incidentStatus", enumName(snapshot.getIncidentStatus()));
        mapped.put("startState", enumName(snapshot.getStartState()));
        mapped.put("finalState", enumName(snapshot.getFinalState()));
        mapped.put("severity", snapshot.getSeverity());
        mapped.put("startedAt", snapshot.getStartedAt());
        mapped.put("resolvedAt", snapshot.getResolvedAt());
        mapped.put("stateTransition", snapshot.getStateTransition());
        mapped.put("triggerReason", snapshot.getTriggerReason());
        mapped.put("lastGoodSnapshotId", snapshot.getLastGoodSnapshotId());
        mapped.put("sourceAnomalyId", snapshot.getSourceAnomalyId());
        mapped.put("metricSampleCount", snapshot.getMetricSampleCount());
        mapped.put("resolution", enumName(snapshot.getResolution()));
        mapped.put("hasAiAnalysis", StringUtils.hasText(snapshot.getAiAnalysis()));
        if (includeContext) {
            mapped.put("aiContext", parseJsonObject(snapshot.getAiContext()).orElseGet(LinkedHashMap::new));
            mapped.put("metricsTimeline", parseJsonList(snapshot.getMetricsTimeline()));
            mapped.put("aiAnalysis", snapshot.getAiAnalysis());
            mapped.put("aiSummary", snapshot.getAiSummary());
        }
        return mapped;
    }

    private Map<String, Object> mapAnomaly(MetricAnomaly anomaly, boolean includeSnapshots) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", anomaly.getId());
        mapped.put("instanceId", anomaly.getInstanceEntity() != null ? anomaly.getInstanceEntity().getInstanceId() : null);
        mapped.put("metricName", enumName(anomaly.getMetricName()));
        mapped.put("status", enumName(anomaly.getStatus()));
        mapped.put("triggerType", enumName(anomaly.getTriggerType()));
        mapped.put("baselineValue", anomaly.getBaselineValue());
        mapped.put("startValue", anomaly.getStartValue());
        mapped.put("currentValue", anomaly.getCurrentValue());
        mapped.put("peakValue", anomaly.getPeakValue());
        mapped.put("threshold", anomaly.getThreshold());
        mapped.put("spikePercentage", anomaly.getSpikePercentage());
        mapped.put("severity", anomaly.getSeverity());
        mapped.put("instanceState", enumName(anomaly.getInstanceState()));
        mapped.put("message", anomaly.getMessage());
        mapped.put("startedAt", anomaly.getStartedAt());
        mapped.put("lastSeenAt", anomaly.getLastSeenAt());
        mapped.put("resolvedAt", anomaly.getResolvedAt());
        mapped.put("preSpikeSnapshotId", anomaly.getPreSpikeSnapshotId());
        mapped.put("startSnapshotId", anomaly.getStartSnapshotId());
        mapped.put("peakSnapshotId", anomaly.getPeakSnapshotId());
        mapped.put("recoverySnapshotId", anomaly.getRecoverySnapshotId());
        if (includeSnapshots) {
            mapped.put("snapshots", metricSnapshotRepository
                    .findByAnomaly_IdOrderByCollectedAtAsc(anomaly.getId())
                    .stream()
                    .map(this::mapMetricSnapshot)
                    .toList());
        }
        return mapped;
    }

    private Map<String, Object> mapMetricSnapshot(MetricsSnapshot snapshot) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", snapshot.getId());
        mapped.put("type", enumName(snapshot.getSnapshotType()));
        mapped.put("cpuUsage", snapshot.getCpuUsage());
        mapped.put("memoryUsage", snapshot.getMemoryUsage());
        mapped.put("diskUsage", snapshot.getDiskUsage());
        mapped.put("diskIops", snapshot.getDiskIops());
        mapped.put("networkIn", snapshot.getNetworkIn());
        mapped.put("networkOut", snapshot.getNetworkOut());
        mapped.put("instanceState", snapshot.getInstanceStateLabel());
        mapped.put("isValid", snapshot.getIsValid());
        mapped.put("errorType", snapshot.getErrorType());
        mapped.put("errorMessage", snapshot.getErrorMessage());
        mapped.put("note", snapshot.getNote());
        mapped.put("collectedAt", snapshot.getCollectedAt());
        return mapped;
    }

    private Optional<Map<String, Object>> parseJsonObject(String rawJson) {
        if (!StringUtils.hasText(rawJson)) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(rawJson, new TypeReference<>() {}));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private List<Object> parseJsonList(String rawJson) {
        if (!StringUtils.hasText(rawJson)) {
            return List.of();
        }
        try {
            return objectMapper.readValue(rawJson, new TypeReference<>() {});
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private String enumName(Enum<?> value) {
        return value != null ? value.name() : null;
    }
}
