package com.sentinal.registry.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.dto.ai.AiChatRequest;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.ai.AiAnalysisService;
import com.sentinal.registry.service.metrics.IncidentSnapshotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
@Slf4j
public class SnapshotController {

    private final IncidentSnapshotRepository incidentRepository;
    private final InstanceRepository instanceRepository;
    private final AiAnalysisService aiAnalysisService;
    private final IncidentSnapshotService incidentSnapshotService;
    private final ObjectMapper objectMapper;

    @GetMapping("/{id}/incidents")
    public ResponseEntity<?> getIncidents(@PathVariable Long id,
                                          @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .map(i -> {
                    List<IncidentSnapshot> incidents = incidentRepository
                            .findTop20ByInstanceEntity_IdOrderByStartedAtDesc(i.getId())
                            .stream()
                            .filter(this::shouldExposeSnapshot)
                            .toList();
                    return ResponseEntity.ok(incidents);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/incidents/active")
    public ResponseEntity<?> getActiveIncident(@PathVariable Long id,
                                               @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .map(i -> incidentRepository
                        .findFirstByInstanceEntity_IdAndIncidentStatusOrderByStartedAtDesc(
                                i.getId(),
                                com.sentinal.registry.model.snapshot.IncidentLifecycleStatus.ACTIVE
                        )
                        .<ResponseEntity<?>>map(ResponseEntity::ok)
                        .orElse(ResponseEntity.noContent().build()))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/incidents/{incidentId}/ai-context")
    public ResponseEntity<?> getAiContext(@PathVariable Long id,
                                          @PathVariable Long incidentId,
                                          @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .flatMap(i -> incidentRepository.findById(incidentId)
                        .filter(incident -> incident.getInstanceEntity() != null
                                && incident.getInstanceEntity().getId().equals(i.getId())))
                .flatMap(incident -> aiAnalysisService.buildAiSnapshot(id, incidentId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/incidents/{incidentId}/ai-snapshot")
    public ResponseEntity<?> getAiSnapshot(@PathVariable Long id,
                                           @PathVariable Long incidentId,
                                           @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .flatMap(i -> incidentRepository.findById(incidentId)
                        .filter(incident -> incident.getInstanceEntity() != null
                                && incident.getInstanceEntity().getId().equals(i.getId())))
                .flatMap(incident -> aiAnalysisService.buildAiSnapshot(id, incidentId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/incidents/{incidentId}/ai-analysis")
    public ResponseEntity<?> saveAiAnalysis(@PathVariable Long id,
                                            @PathVariable Long incidentId,
                                            @RequestBody String analysis,
                                            @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .flatMap(i -> incidentRepository.findById(incidentId))
                .map(incident -> {
                    incident.setAiAnalysis(analysis);
                    incident.setAiSummary(analysis);
                    incidentRepository.save(incident);
                    return ResponseEntity.ok().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/incidents/{incidentId}/analyze")
    public ResponseEntity<?> triggerAiAnalysis(@PathVariable Long id,
                                               @PathVariable Long incidentId,
                                               @RequestBody(required = false) AiChatRequest body,
                                               @AuthenticationPrincipal UserDetails userDetails) {
        String prompt = body != null ? body.getPrompt() : null;
        List<Map<String, String>> chatHistory = extractChatHistory(body);
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .flatMap(i -> incidentRepository.findById(incidentId)
                        .filter(incident -> incident.getInstanceEntity() != null
                                && incident.getInstanceEntity().getId().equals(i.getId())))
                .map(incident -> {
                    try {
                        log.info("Triggering AI analysis for instanceId={} incidentId={} promptChars={}",
                                id, incidentId, prompt != null ? prompt.length() : 0);
                        var response = aiAnalysisService.analyzeIncident(incident, prompt, chatHistory);
                        incident.setAiAnalysis(response.getCombinedAnalysis());
                        incident.setAiSummary(response.getCombinedAnalysis());
                        incidentRepository.save(incident);
                        incidentSnapshotService.onAiAnalysisCreated(
                                incident,
                                "AI analysis generated for incident " + incident.getId()
                        );
                        return ResponseEntity.ok(response);
                    } catch (Exception e) {
                        return ResponseEntity.status(500)
                                .body(Map.of("error", "AI analysis failed: " + e.getMessage()));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/analyze")
    public ResponseEntity<?> triggerInstanceAiAnalysis(@PathVariable Long id,
                                                       @RequestBody(required = false) AiChatRequest body,
                                                       @AuthenticationPrincipal UserDetails userDetails) {
        String prompt = body != null ? body.getPrompt() : null;
        List<Map<String, String>> chatHistory = extractChatHistory(body);
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .map(instance -> {
                    try {
                        log.info("Triggering instance AI chat for instanceId={} promptChars={}",
                                id, prompt != null ? prompt.length() : 0);
                        return ResponseEntity.ok(aiAnalysisService.analyzeInstance(instance, prompt, chatHistory));
                    } catch (Exception e) {
                        return ResponseEntity.status(500)
                                .body(Map.of("error", "AI analysis failed: " + e.getMessage()));
                    }
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/ai/health")
    public ResponseEntity<?> checkAiServiceHealth() {
        boolean available = aiAnalysisService.isAiServiceAvailable();
        return ResponseEntity.ok(Map.of(
                "available", available,
                "message", available ? "AI service is available" : "AI service is not available"
        ));
    }

    private boolean shouldExposeSnapshot(IncidentSnapshot snapshot) {
        if (snapshot.getSourceAnomalyId() == null) {
            return true;
        }

        String rawContext = snapshot.getAiContext();
        if (rawContext == null || rawContext.isBlank()) {
            return true;
        }

        try {
            Map<String, Object> context = objectMapper.readValue(rawContext, new TypeReference<>() {});
            Object anomaliesValue = context.get("activeAnomalies");
            if (!(anomaliesValue instanceof List<?> anomalies) || anomalies.isEmpty()) {
                return true;
            }
            Object first = anomalies.get(0);
            if (!(first instanceof Map<?, ?> anomaly)) {
                return true;
            }

            Object metricNameValue = anomaly.get("metricName");
            String metricName = metricNameValue != null ? String.valueOf(metricNameValue) : "CPU";
            double maxValue = Math.max(
                    parseDouble(anomaly.get("peakValue")),
                    Math.max(parseDouble(anomaly.get("startValue")), parseDouble(anomaly.get("currentValue")))
            );
            return switch (metricName) {
                case "CPU" -> maxValue >= 25.0;
                case "MEMORY" -> maxValue >= 70.0;
                case "DISK" -> maxValue >= 80.0;
                default -> maxValue > 0.0;
            };
        } catch (Exception ignored) {
            return true;
        }
    }

    private List<Map<String, String>> extractChatHistory(AiChatRequest body) {
        if (body == null || body.getChatHistory() == null) {
            return List.of();
        }
        return body.getChatHistory().stream()
                .map(entry -> {
                    java.util.Map<String, String> mapped = new java.util.LinkedHashMap<>();
                    String role = entry.get("role");
                    String content = entry.get("content");
                    if (role != null && content != null) {
                        mapped.put("role", role);
                        mapped.put("content", content);
                    }
                    return mapped;
                })
                .filter(entry -> !entry.isEmpty())
                .limit(10)
                .toList();
    }

    private double parseDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value == null) {
            return 0.0;
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException ignored) {
            return 0.0;
        }
    }
}
