package com.sentinal.registry.service.ai;

import com.sentinal.registry.dto.ai.*;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
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

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    public AiAnalysisResponse analyzeIncident(IncidentSnapshot incident) {
        return analyzeIncident(incident, null);
    }

    public AiAnalysisResponse analyzeIncident(IncidentSnapshot incident, String analysisTask) {
        log.info("Starting AI analysis for incident {} of instance {}", 
                incident.getId(), incident.getInstanceEntity().getInstanceId());

        InstanceEntity instance = incident.getInstanceEntity();
        AiAnalysisRequest request = buildAnalysisRequest(instance, List.of(incident), List.of(), analysisTask);

        // Call AI service
        return aiClient.analyze(request);
    }

    /**
     * Triggers AI analysis for an instance asynchronously.
     * 
     * @param instance The instance to analyze
     */
    public Optional<Long> analyzeInstanceAsync(InstanceEntity instance)
    {
        log.info("Triggering async AI analysis for instance {}", instance.getInstanceId());

        return incidentRepository
                .findFirstByInstanceEntity_InstanceIdAndIncidentEndTimeIsNotNullOrderByIncidentEndTimeDesc(
                        instance.getInstanceId())
                .map(incident -> {
                    aiClient.analyzeAsync(buildAnalysisRequest(
                            instance,
                            List.of(incident),
                            List.of(),
                            null
                    )).thenAccept(response -> {
                        incident.setAiAnalysis(response.getCombinedAnalysis());
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
            List<MetricsSnapshot> metrics) {
        return buildAnalysisRequest(instance, incidents, metrics, null);
    }

    private AiAnalysisRequest buildAnalysisRequest(
            InstanceEntity instance,
            List<IncidentSnapshot> incidents,
            List<MetricsSnapshot> metrics,
            String analysisTask) {

        return AiAnalysisRequest.builder()
                .instance(mapInstanceDetails(instance))
                .incidentSnapshots(incidents.stream()
                        .map(this::mapIncidentSnapshot)
                        .collect(Collectors.toList()))
                .metricsSnapshots(metrics.stream()
                        .map(this::mapMetricsSnapshot)
                        .collect(Collectors.toList()))
                .analysisTask(analysisTask)
                .build();
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
                .incidentStartTime(incident.getIncidentStartTime() != null 
                        ? incident.getIncidentStartTime().format(FORMATTER) : null)
                .incidentEndTime(incident.getIncidentEndTime() != null 
                        ? incident.getIncidentEndTime().format(FORMATTER) : null)
                .resolution(incident.getResolution() != null 
                        ? incident.getResolution().name() : null)
                .metricsTimeline(incident.getMetricsTimeline())
                .aiContext(incident.getAiContext())
                .aiAnalysis(incident.getAiAnalysis())
                .build();
    }

    private AiMetricsSnapshot mapMetricsSnapshot(MetricsSnapshot metrics) {
        return AiMetricsSnapshot.builder()
                .id(metrics.getId())
                .errorType(metrics.getErrorType())
                .errorMessage(metrics.getErrorMessage())
                .snapshotTime(metrics.getSnapshotTime() != null 
                        ? metrics.getSnapshotTime().format(FORMATTER) : null)
                .cpuUsage(metrics.getCpuUsage())
                .memoryUsage(metrics.getMemoryUsage())
                .networkIn(metrics.getNetworkIn())
                .networkOut(metrics.getNetworkOut())
                .diskIops(metrics.getDiskIops())
                .instanceState(metrics.getInstanceState())
                .aiContext(metrics.getAiContext())
                .build();
    }

    /**
     * Checks if the AI service is available.
     */
    public boolean isAiServiceAvailable() {
        return aiClient.isServiceAvailable();
    }
}
