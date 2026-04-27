package com.sentinal.registry.controller;

import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.ai.AiAnalysisService;
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

    @GetMapping("/{id}/incidents")
    public ResponseEntity<?> getIncidents(@PathVariable Long id,
                                          @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .map(i -> {
                    List<IncidentSnapshot> incidents = incidentRepository
                            .findByInstanceEntity_InstanceIdAndResolvedAtIsNotNullOrderByStartedAtDesc(
                                    i.getInstanceId());
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
                        .findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc(i.getInstanceId())
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
                .flatMap(i -> incidentRepository.findById(incidentId))
                .map(incident -> ResponseEntity.ok(incident.getAiContext()))
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
                                               @RequestBody(required = false) Map<String, String> body,
                                               @AuthenticationPrincipal UserDetails userDetails) {
        String prompt = body != null ? body.get("prompt") : null;
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .flatMap(i -> incidentRepository.findById(incidentId)
                        .filter(incident -> incident.getInstanceEntity() != null
                                && incident.getInstanceEntity().getId().equals(i.getId())))
                .map(incident -> {
                    try {
                        log.info("Triggering AI analysis for instanceId={} incidentId={} promptChars={}",
                                id, incidentId, prompt != null ? prompt.length() : 0);
                        var response = aiAnalysisService.analyzeIncident(incident, prompt);
                        incident.setAiAnalysis(response.getCombinedAnalysis());
                        incident.setAiSummary(response.getCombinedAnalysis());
                        incidentRepository.save(incident);
                        return ResponseEntity.ok(response);
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
}
