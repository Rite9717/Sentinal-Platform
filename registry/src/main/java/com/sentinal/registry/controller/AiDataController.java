package com.sentinal.registry.controller;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.MetricAnomaly;
import com.sentinal.registry.model.snapshot.MetricSnapshotRollup;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.repository.MetricAnomalyRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import com.sentinal.registry.repository.MetricSnapshotRollupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AiDataController
{

    private final InstanceRepository instanceRepository;
    private final MetricSnapshotRepository snapshotRepository;
    private final MetricSnapshotRollupRepository rollupRepository;
    private final MetricAnomalyRepository anomalyRepository;
    private final IncidentSnapshotRepository incidentRepository;

    @GetMapping("/instances/{instanceId}")
    public ResponseEntity<?> getInstanceByInstanceId(@PathVariable String instanceId)
    {
        return instanceRepository.findByInstanceId(instanceId)
                .map(instance -> ResponseEntity.ok(mapInstance(instance)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/metrics/snapshots/{instanceId}/recent")
    public ResponseEntity<?> getRecentSnapshots(@PathVariable String instanceId)
    {
        if (!instanceRepository.existsByInstanceId(instanceId))
        {
            return ResponseEntity.notFound().build();
        }
        List<Map<String, Object>> snapshots = snapshotRepository
                .findTop20ByInstanceEntity_InstanceIdOrderByCollectedAtDesc(instanceId)
                .stream()
                .map(this::mapSnapshot)
                .collect(Collectors.toList());
        return ResponseEntity.ok(snapshots);
    }

    @GetMapping("/metrics/rollups/{instanceId}")
    public ResponseEntity<?> getMetricRollups(
            @PathVariable String instanceId,
            @RequestParam(defaultValue = "1") Integer bucketMinutes,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "120") Integer limit
    ) {
        if (!instanceRepository.existsByInstanceId(instanceId)) {
            return ResponseEntity.notFound().build();
        }

        int safeBucket = (bucketMinutes != null && bucketMinutes == 15) ? 15 : 1;
        int safeLimit = Math.max(1, Math.min(limit != null ? limit : 120, 500));

        List<Map<String, Object>> rollups;
        LocalDateTime fromTime = parseIsoDateTime(from);
        LocalDateTime toTime = parseIsoDateTime(to);

        if (fromTime != null && toTime != null) {
            rollups = rollupRepository
                    .findByInstanceEntity_InstanceIdAndBucketMinutesAndBucketStartGreaterThanEqualAndBucketStartLessThanEqualOrderByBucketStartAsc(
                            instanceId,
                            safeBucket,
                            fromTime,
                            toTime
                    )
                    .stream()
                    .map(this::mapRollup)
                    .collect(Collectors.toList());
        } else {
            rollups = rollupRepository
                    .findByInstanceEntity_InstanceIdAndBucketMinutesOrderByBucketStartDesc(
                            instanceId,
                            safeBucket,
                            PageRequest.of(0, safeLimit)
                    )
                    .stream()
                    .map(this::mapRollup)
                    .collect(Collectors.toList());
        }

        return ResponseEntity.ok(rollups);
    }

    @GetMapping("/metrics/anomalies/{instanceId}/recent")
    public ResponseEntity<?> getRecentAnomalies(@PathVariable String instanceId)
    {
        if (!instanceRepository.existsByInstanceId(instanceId))
        {
            return ResponseEntity.notFound().build();
        }
        List<Map<String, Object>> anomalies = anomalyRepository
                .findRecentByInstanceId(instanceId)
                .stream()
                .limit(20)
                .map(this::mapAnomaly)
                .collect(Collectors.toList());
        return ResponseEntity.ok(anomalies);
    }

    @GetMapping("/incidents/{instanceId}/recent")
    public ResponseEntity<?> getRecentIncidents(@PathVariable String instanceId)
    {
        if (!instanceRepository.existsByInstanceId(instanceId)) {
            return ResponseEntity.notFound().build();
        }
        List<Map<String, Object>> incidents = incidentRepository
                .findTop20ByInstanceEntity_InstanceIdOrderByStartedAtDesc(instanceId)
                .stream()
                .map(this::mapIncident)
                .collect(Collectors.toList());
        return ResponseEntity.ok(incidents);
    }

    private Map<String, Object> mapInstance(InstanceEntity instance) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", instance.getId());
        body.put("instanceId", instance.getInstanceId());
        body.put("region", instance.getRegion());
        body.put("nickname", instance.getNickname());
        body.put("state", instance.getState() != null ? instance.getState().name() : null);
        body.put("suspectCount", instance.getSuspectCount());
        body.put("quarantineCount", instance.getQuarantineCount());
        body.put("quarantineDurationMinutes", instance.getQuarantineDurationMinutes());
        body.put("maxSuspectStrikes", instance.getMaxSuspectStrikes());
        body.put("maxQuarantineCycles", instance.getMaxQuarantineCycles());
        body.put("lastCheckedAt", instance.getLastCheckedAt());
        body.put("stateChangedAt", instance.getStateChangedAt());
        body.put("quarantineUntil", instance.getQuarantineUntil());
        body.put("lastError", instance.getLastError());
        return body;
    }

    private Map<String, Object> mapSnapshot(MetricsSnapshot snapshot) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", snapshot.getId());
        body.put("instanceId", snapshot.getInstanceEntity() != null ? snapshot.getInstanceEntity().getInstanceId() : null);
        body.put("isValid", snapshot.getIsValid());
        body.put("collectedAt", snapshot.getCollectedAt());
        body.put("snapshotTime", snapshot.getSnapshotTime());
        body.put("cpuUsage", snapshot.getCpuUsage());
        body.put("memoryUsage", snapshot.getMemoryUsage());
        body.put("diskUsage", snapshot.getDiskUsage());
        body.put("networkIn", snapshot.getNetworkIn());
        body.put("networkOut", snapshot.getNetworkOut());
        body.put("errorType", snapshot.getErrorType());
        body.put("errorMessage", snapshot.getErrorMessage());
        body.put("instanceState", snapshot.getInstanceState());
        return body;
    }

    private Map<String, Object> mapAnomaly(MetricAnomaly anomaly) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", anomaly.getId());
        body.put("instanceId", anomaly.getInstanceEntity() != null ? anomaly.getInstanceEntity().getInstanceId() : null);
        body.put("metricName", anomaly.getMetricName());
        body.put("metricValue", anomaly.getMetricValue());
        body.put("threshold", anomaly.getThreshold());
        body.put("severity", anomaly.getSeverity());
        body.put("instanceState", anomaly.getInstanceState() != null ? anomaly.getInstanceState().name() : null);
        body.put("message", anomaly.getMessage());
        body.put("createdAt", anomaly.getCreatedAt());
        body.put("resolvedAt", anomaly.getResolvedAt());
        return body;
    }

    private Map<String, Object> mapIncident(IncidentSnapshot incident) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", incident.getId());
        body.put("instanceId", incident.getInstanceEntity() != null ? incident.getInstanceEntity().getInstanceId() : null);
        body.put("status", incident.getStatus() != null ? incident.getStatus().name() : null);
        body.put("severity", incident.getSeverity());
        body.put("startedAt", incident.getStartedAt());
        body.put("resolvedAt", incident.getResolvedAt());
        body.put("stateTransition", incident.getStateTransition());
        body.put("triggerReason", incident.getTriggerReason());
        body.put("lastGoodSnapshotId", incident.getLastGoodSnapshotId());
        body.put("resolution", incident.getResolution() != null ? incident.getResolution().name() : null);
        body.put("metricsTimeline", incident.getMetricsTimeline());
        body.put("aiSummary", incident.getAiSummary());
        return body;
    }

    private Map<String, Object> mapRollup(MetricSnapshotRollup rollup) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", rollup.getId());
        body.put("instanceId", rollup.getInstanceEntity() != null ? rollup.getInstanceEntity().getInstanceId() : null);
        body.put("bucketStart", rollup.getBucketStart());
        body.put("bucketMinutes", rollup.getBucketMinutes());
        body.put("isValid", rollup.getIsValid());
        body.put("sampleCount", rollup.getSampleCount());

        body.put("cpuAvg", rollup.getCpuAvg());
        body.put("cpuMin", rollup.getCpuMin());
        body.put("cpuMax", rollup.getCpuMax());
        body.put("cpuP95", rollup.getCpuP95());

        body.put("memoryAvg", rollup.getMemoryAvg());
        body.put("memoryMin", rollup.getMemoryMin());
        body.put("memoryMax", rollup.getMemoryMax());
        body.put("memoryP95", rollup.getMemoryP95());

        body.put("diskAvg", rollup.getDiskAvg());
        body.put("diskMin", rollup.getDiskMin());
        body.put("diskMax", rollup.getDiskMax());
        body.put("diskP95", rollup.getDiskP95());

        body.put("networkInAvg", rollup.getNetworkInAvg());
        body.put("networkInMin", rollup.getNetworkInMin());
        body.put("networkInMax", rollup.getNetworkInMax());
        body.put("networkInP95", rollup.getNetworkInP95());

        body.put("networkOutAvg", rollup.getNetworkOutAvg());
        body.put("networkOutMin", rollup.getNetworkOutMin());
        body.put("networkOutMax", rollup.getNetworkOutMax());
        body.put("networkOutP95", rollup.getNetworkOutP95());
        return body;
    }

    private LocalDateTime parseIsoDateTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(value);
        } catch (Exception ignored) {
            return null;
        }
    }
}
