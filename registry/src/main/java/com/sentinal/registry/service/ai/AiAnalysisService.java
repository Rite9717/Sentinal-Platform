package com.sentinal.registry.service.ai;

import com.sentinal.registry.dto.ai.*;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.MetricAnomaly;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.MetricAnomalyRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class AiAnalysisService {

    private final SentinelAiClient aiClient;
    private final IncidentSnapshotRepository incidentRepository;
    private final MetricSnapshotRepository metricsRepository;
    private final MetricAnomalyRepository anomalyRepository;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public AiAnalysisResponse analyzeIncident(IncidentSnapshot incident) {
        return analyzeIncident(incident, null);
    }

    public AiAnalysisResponse analyzeIncident(IncidentSnapshot incident, String analysisTask) {
        log.info("Starting AI analysis for incident {} of instance {}",
                incident.getId(), incident.getInstanceEntity().getInstanceId());

        InstanceEntity instance = incident.getInstanceEntity();
        String instanceId = instance.getInstanceId();

        Optional<MetricsSnapshot> lastGoodSnapshot = resolveLastGoodSnapshot(incident, instanceId);
        List<MetricsSnapshot> recentPreIncidentSnapshots = resolveRecentSnapshotsBeforeIncident(incident, instanceId);
        List<MetricsSnapshot> metricPayload = mergeMetrics(lastGoodSnapshot.orElse(null), recentPreIncidentSnapshots);

        List<MetricAnomaly> unresolved = anomalyRepository
                .findByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByCreatedAtDesc(instanceId);
        List<MetricAnomaly> recent = anomalyRepository.findRecentByInstanceId(instanceId);
        List<MetricAnomaly> anomalyPayload = mergeAnomalies(unresolved, recent);

        AiAnalysisRequest request = buildAnalysisRequest(
                instance,
                List.of(incident),
                metricPayload,
                anomalyPayload,
                lastGoodSnapshot.orElse(null),
                analysisTask,
                incident.getId()
        );

        return aiClient.analyze(request);
    }

    /**
     * Triggers AI analysis for an instance asynchronously.
     */
    public Optional<Long> analyzeInstanceAsync(InstanceEntity instance) {
        log.info("Triggering async AI analysis for instance {}", instance.getInstanceId());

        return incidentRepository
                .findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNotNullOrderByResolvedAtDesc(
                        instance.getInstanceId())
                .map(incident -> {
                    Optional<MetricsSnapshot> lastGood = resolveLastGoodSnapshot(incident, instance.getInstanceId());
                    List<MetricsSnapshot> recentMetrics = resolveRecentSnapshotsBeforeIncident(incident, instance.getInstanceId());
                    List<MetricAnomaly> unresolved = anomalyRepository
                            .findByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByCreatedAtDesc(instance.getInstanceId());
                    List<MetricAnomaly> recent = anomalyRepository.findRecentByInstanceId(instance.getInstanceId());

                    AiAnalysisRequest request = buildAnalysisRequest(
                            instance,
                            List.of(incident),
                            mergeMetrics(lastGood.orElse(null), recentMetrics),
                            mergeAnomalies(unresolved, recent),
                            lastGood.orElse(null),
                            null,
                            incident.getId()
                    );

                    aiClient.analyzeAsync(request).thenAccept(response -> {
                        incident.setAiAnalysis(response.getCombinedAnalysis());
                        incident.setAiSummary(response.getCombinedAnalysis());
                        incidentRepository.save(incident);
                        log.info("AI analysis saved for incident {} of instance {}",
                                incident.getId(), instance.getInstanceId());
                    }).exceptionally(ex -> {
                        log.error("Async AI analysis failed for instance {}: {}",
                                instance.getInstanceId(), ex.getMessage());
                        return null;
                    });
                    return incident.getId();
                });
    }

    private AiAnalysisRequest buildAnalysisRequest(
            InstanceEntity instance,
            List<IncidentSnapshot> incidents,
            List<MetricsSnapshot> metrics,
            List<MetricAnomaly> anomalies,
            MetricsSnapshot lastGoodSnapshot,
            String analysisTask,
            Long selectedSnapshotId
    ) {
        return AiAnalysisRequest.builder()
                .instance(mapInstanceDetails(instance))
                .selectedSnapshotId(selectedSnapshotId)
                .lastGoodSnapshot(lastGoodSnapshot != null ? mapMetricsSnapshot(lastGoodSnapshot) : null)
                .incidentSnapshots(incidents.stream()
                        .map(this::mapIncidentSnapshot)
                        .collect(Collectors.toList()))
                .metricsSnapshots(metrics.stream()
                        .map(this::mapMetricsSnapshot)
                        .collect(Collectors.toList()))
                .metricAnomalies(anomalies.stream()
                        .map(this::mapMetricAnomaly)
                        .collect(Collectors.toList()))
                .analysisTask(analysisTask)
                .build();
    }

    private Optional<MetricsSnapshot> resolveLastGoodSnapshot(IncidentSnapshot incident, String instanceId) {
        if (incident.getLastGoodSnapshotId() != null) {
            Optional<MetricsSnapshot> byIncidentLink = metricsRepository.findById(incident.getLastGoodSnapshotId());
            if (byIncidentLink.isPresent()) {
                return byIncidentLink;
            }
        }
        return metricsRepository.findTopByInstanceEntity_InstanceIdAndIsValidTrueOrderByCollectedAtDesc(instanceId);
    }

    private List<MetricsSnapshot> resolveRecentSnapshotsBeforeIncident(IncidentSnapshot incident, String instanceId) {
        LocalDateTime start = incident.getStartedAt();
        if (start != null) {
            return metricsRepository.findTop20ByInstanceEntity_InstanceIdAndCollectedAtLessThanEqualOrderByCollectedAtDesc(
                    instanceId,
                    start
            );
        }
        return metricsRepository.findTop20ByInstanceEntity_InstanceIdOrderByCollectedAtDesc(instanceId);
    }

    private List<MetricsSnapshot> mergeMetrics(MetricsSnapshot lastGood, List<MetricsSnapshot> recent) {
        LinkedHashMap<Long, MetricsSnapshot> merged = new LinkedHashMap<>();
        if (lastGood != null && lastGood.getId() != null) {
            merged.put(lastGood.getId(), lastGood);
        }
        for (MetricsSnapshot snapshot : recent) {
            if (snapshot.getId() != null) {
                merged.putIfAbsent(snapshot.getId(), snapshot);
            }
        }
        return new ArrayList<>(merged.values())
                .stream()
                .limit(30)
                .collect(Collectors.toList());
    }

    private List<MetricAnomaly> mergeAnomalies(List<MetricAnomaly> unresolved, List<MetricAnomaly> recent) {
        LinkedHashMap<Long, MetricAnomaly> merged = new LinkedHashMap<>();
        for (MetricAnomaly anomaly : unresolved) {
            if (anomaly.getId() != null) {
                merged.putIfAbsent(anomaly.getId(), anomaly);
            }
        }
        for (MetricAnomaly anomaly : recent) {
            if (anomaly.getId() != null) {
                merged.putIfAbsent(anomaly.getId(), anomaly);
            }
        }
        return new ArrayList<>(merged.values())
                .stream()
                .limit(30)
                .collect(Collectors.toList());
    }

    private AiInstanceDetails mapInstanceDetails(InstanceEntity instance) {
        return AiInstanceDetails.builder()
                .instanceId(instance.getInstanceId())
                .region(instance.getRegion())
                .nickname(instance.getNickname())
                .state(instance.getState().name())
                .suspectCount(instance.getSuspectCount())
                .quarantineCount(instance.getQuarantineCount())
                .maxSuspectStrikes(instance.getMaxSuspectStrikes())
                .maxQuarantineCycles(instance.getMaxQuarantineCycles())
                .quarantineDurationMinutes(instance.getQuarantineDurationMinutes())
                .lastError(instance.getLastError())
                .stateChangedAt(instance.getStateChangedAt())
                .build();
    }

    private AiIncidentSnapshot mapIncidentSnapshot(IncidentSnapshot incident) {
        return AiIncidentSnapshot.builder()
                .id(incident.getId())
                .status(incident.getStatus() != null ? incident.getStatus().name() : null)
                .severity(incident.getSeverity())
                .startedAt(format(incident.getStartedAt()))
                .resolvedAt(format(incident.getResolvedAt()))
                .stateTransition(incident.getStateTransition())
                .triggerReason(incident.getTriggerReason())
                .lastGoodSnapshotId(incident.getLastGoodSnapshotId())
                .resolution(incident.getResolution() != null ? incident.getResolution().name() : null)
                .metricsTimeline(incident.getMetricsTimeline())
                .aiContext(incident.getAiContext())
                .aiAnalysis(incident.getAiAnalysis())
                .aiSummary(incident.getAiSummary())
                .build();
    }

    private AiMetricsSnapshot mapMetricsSnapshot(MetricsSnapshot metrics) {
        return AiMetricsSnapshot.builder()
                .id(metrics.getId())
                .isValid(metrics.getIsValid())
                .errorType(metrics.getErrorType())
                .errorMessage(metrics.getErrorMessage())
                .collectedAt(format(metrics.getCollectedAt()))
                .snapshotTime(format(metrics.getSnapshotTime()))
                .cpuUsage(metrics.getCpuUsage())
                .memoryUsage(metrics.getMemoryUsage())
                .diskUsage(metrics.getDiskUsage())
                .networkIn(metrics.getNetworkIn())
                .networkOut(metrics.getNetworkOut())
                .diskIops(metrics.getDiskIops())
                .instanceState(metrics.getInstanceState())
                .aiContext(metrics.getAiContext())
                .build();
    }

    private AiMetricAnomaly mapMetricAnomaly(MetricAnomaly anomaly) {
        return AiMetricAnomaly.builder()
                .id(anomaly.getId())
                .metricName(anomaly.getMetricName())
                .metricValue(anomaly.getMetricValue())
                .threshold(anomaly.getThreshold())
                .severity(anomaly.getSeverity())
                .instanceState(anomaly.getInstanceState() != null ? anomaly.getInstanceState().name() : null)
                .message(anomaly.getMessage())
                .createdAt(format(anomaly.getCreatedAt()))
                .resolvedAt(format(anomaly.getResolvedAt()))
                .build();
    }

    private String format(LocalDateTime value) {
        return value != null ? value.format(FORMATTER) : null;
    }

    /**
     * Checks if the AI service is available.
     */
    public boolean isAiServiceAvailable() {
        return aiClient.isServiceAvailable();
    }
}
