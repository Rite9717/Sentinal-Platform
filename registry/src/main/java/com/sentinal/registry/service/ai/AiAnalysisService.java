package com.sentinal.registry.service.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.dto.ai.*;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
public class AiAnalysisService {

    private final SentinelAiClient aiClient;
    private final IncidentSnapshotRepository incidentRepository;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public AiAnalysisResponse analyzeIncident(IncidentSnapshot incident) {
        return analyzeIncident(incident, null);
    }

    public AiAnalysisResponse analyzeIncident(IncidentSnapshot incident, String analysisTask) {
        log.info("Starting AI analysis for incident {} of instance {}",
                incident.getId(), incident.getInstanceEntity().getInstanceId());

        InstanceEntity instance = incident.getInstanceEntity();
        Map<String, Object> structuredContext = buildStructuredContext(instance.getId(), incident.getId());

        AiAnalysisRequest request = buildAnalysisRequest(
                instance,
                analysisTask,
                incident.getId(),
                structuredContext
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
                    Map<String, Object> structuredContext = buildStructuredContext(instance.getId(), incident.getId());

                    AiAnalysisRequest request = buildAnalysisRequest(
                            instance,
                            null,
                            incident.getId(),
                            structuredContext
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
            String analysisTask,
            Long selectedSnapshotId,
            Map<String, Object> structuredContext
    ) {
        return AiAnalysisRequest.builder()
                .instance(mapInstanceDetails(instance))
                .selectedSnapshotId(selectedSnapshotId)
                .lastGoodSnapshot(null)
                .incidentSnapshots(List.of())
                .metricsSnapshots(List.of())
                .metricAnomalies(List.of())
                .analysisTask(analysisTask)
                .agentContext(structuredContext)
                .build();
    }

    public Optional<Map<String, Object>> buildAiSnapshot(Long instanceDbId, Long incidentId) {
        Optional<Map<String, Object>> storedSnapshot = incidentRepository.findById(incidentId)
                .flatMap(this::parseStoredAiContext);
        if (storedSnapshot.isPresent()) {
            return storedSnapshot;
        }
        return incidentRepository.findById(incidentId).map(this::buildFallbackSnapshot);
    }

    private Map<String, Object> buildStructuredContext(Long instanceDbId, Long incidentId) {
        Optional<Map<String, Object>> storedSnapshot = incidentRepository.findById(incidentId)
                .flatMap(this::parseStoredAiContext);
        if (storedSnapshot.isPresent()) {
            return storedSnapshot.get();
        }
        return incidentRepository.findById(incidentId)
                .map(this::buildFallbackSnapshot)
                .orElseGet(LinkedHashMap::new);
    }

    private Optional<Map<String, Object>> parseStoredAiContext(IncidentSnapshot incident) {
        String raw = incident.getAiContext();
        if (raw == null || raw.isBlank() || "{}".equals(raw.trim())) {
            return Optional.empty();
        }
        try {
            Map<String, Object> parsed = objectMapper.readValue(raw, new TypeReference<>() {});
            return parsed.isEmpty() ? Optional.empty() : Optional.of(parsed);
        } catch (Exception e) {
            log.warn("Stored AI snapshot context for incident {} is not valid JSON: {}", incident.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    private Map<String, Object> buildFallbackSnapshot(IncidentSnapshot incident) {
        Map<String, Object> payload = new LinkedHashMap<>();
        Map<String, Object> instance = new LinkedHashMap<>();
        if (incident.getInstanceEntity() != null) {
            InstanceEntity entity = incident.getInstanceEntity();
            instance.put("instanceId", entity.getInstanceId());
            instance.put("state", entity.getState() != null ? entity.getState().name() : null);
            instance.put("region", entity.getRegion());
        }
        payload.put("instance", instance);
        payload.put("latestMetrics", new LinkedHashMap<>());
        payload.put("activeAnomalies", List.of());

        Map<String, Object> incidentPayload = new LinkedHashMap<>();
        incidentPayload.put("status", incident.getIncidentStatus() != null
                ? incident.getIncidentStatus().name()
                : null);
        incidentPayload.put("startState", incident.getStartState() != null ? incident.getStartState().name() : null);
        incidentPayload.put("triggerReason", incident.getTriggerReason());
        incidentPayload.put("startedAt", format(incident.getStartedAt()));
        payload.put("activeIncident", incidentPayload);

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("eventType", incident.getStateTransition());
        event.put("message", incident.getTriggerReason());
        event.put("createdAt", format(incident.getStartedAt()));
        payload.put("incidentEvents", List.of(event));
        return payload;
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
