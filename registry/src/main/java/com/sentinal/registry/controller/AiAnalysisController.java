package com.sentinal.registry.controller;

import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.repository.AiAnalysisRepository;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.ai.AiAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
public class AiAnalysisController
{

    private final AiAnalysisRepository aiAnalysisRepository;
    private final InstanceRepository instanceRepository;
    private final AiAnalysisService aiAnalysisService;
    private final IncidentSnapshotRepository incidentSnapshotRepository;

    @PostMapping("/{id}/ai-analyses/analyse")
    public ResponseEntity<?> triggerAnalysis(@PathVariable Long id,
                                             @AuthenticationPrincipal UserDetails userDetails)
    {
        var instanceOpt = instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()));

        if (instanceOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        var instance = instanceOpt.get();

        if (!aiAnalysisService.isAiServiceAvailable()) {
            return ResponseEntity.status(503).body(Map.of(
                    "error", "AI analysis service is currently unavailable"
            ));
        }

        Optional<Long> incidentId = aiAnalysisService.analyzeInstanceAsync(instance);

        if (incidentId.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                    "error", "No closed incidents found to analyse"
            ));
        }

        return ResponseEntity.accepted().body(Map.of(
                "instanceId", instance.getInstanceId(),
                "incidentId", incidentId.get(),
                "message", "Analysis started"
        ));
    }


    @GetMapping(value = "/{id}/ai-analyses/{incidentId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamAnalysis(@PathVariable Long id,
                                     @PathVariable Long incidentId,
                                     @AuthenticationPrincipal UserDetails userDetails)
    {
        SseEmitter emitter = new SseEmitter(600_000L);

        instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                .ifPresentOrElse(instance -> {

                    Thread.startVirtualThread(() -> {
                        try {
                            emitter.send(SseEmitter.event().name("status")
                                    .data("{\"message\":\"Waiting for analysis to complete...\"}"));

                            String savedAnalysis = null;
                            int maxAttempts = 36;
                            int attempt = 0;

                            while (attempt < maxAttempts) {
                                Thread.sleep(10_000);
                                attempt++;

                                IncidentSnapshot refreshed = incidentSnapshotRepository
                                        .findById(incidentId).orElse(null);

                                if (refreshed != null && refreshed.getAiAnalysis() != null) {
                                    savedAnalysis = refreshed.getAiAnalysis();
                                    break;
                                }

                                if (attempt % 3 == 0) {
                                    emitter.send(SseEmitter.event().name("thinking")
                                            .data("{\"message\":\"Still analysing...\",\"elapsedSeconds\":" + (attempt * 10) + "}"));
                                }
                            }

                            if (savedAnalysis == null) {
                                emitter.send(SseEmitter.event().name("error")
                                        .data("{\"error\":\"Analysis timed out. Try again later.\"}"));
                                emitter.complete();
                                return;
                            }

                            String[] words = savedAnalysis.split("(?<=\\s)|(?=\\s)");
                            for (String word : words) {
                                emitter.send(SseEmitter.event().name("token").data(word));
                                Thread.sleep(18);
                            }

                            emitter.send(SseEmitter.event().name("done")
                                    .data("{\"instanceId\":\"" + instance.getInstanceId() + 
                                          "\",\"incidentId\":" + incidentId + "}"));
                            emitter.complete();

                        } catch (Exception e) {
                            try {
                                emitter.send(SseEmitter.event().name("error")
                                        .data("{\"error\":\"" + e.getMessage().replace("\"", "\\\"") + "\"}"));
                                emitter.complete();
                            } catch (IOException ex) {
                                emitter.completeWithError(ex);
                            }
                        }
                    });

                }, () -> {
                    try {
                        emitter.send(SseEmitter.event().name("error")
                                .data("{\"error\":\"Instance not found or access denied\"}"));
                        emitter.complete();
                    } catch (IOException e) { emitter.completeWithError(e); }
                });

        return emitter;
    }

    @GetMapping("/{id}/ai-analyses")
    public ResponseEntity<?> getAllAiAnalyses(@PathVariable Long id,
                                              @AuthenticationPrincipal UserDetails userDetails)
    {
        return instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                .map(instance -> {
                    List<IncidentSnapshot> analyses = aiAnalysisRepository
                            .findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullOrderByIncidentEndTimeDesc(instance.getInstanceId());
                    return ResponseEntity.ok(Map.of(
                            "instanceId", instance.getInstanceId(),
                            "nickname", instance.getNickname() != null ? instance.getNickname() : "",
                            "totalAnalyses", analyses.size(),
                            "analyses", analyses
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/ai-analyses/latest")
    public ResponseEntity<?> getLatestAiAnalysis(@PathVariable Long id,@AuthenticationPrincipal UserDetails userDetails)
    {
        return instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                .map(instance -> {
                    List<IncidentSnapshot> analyses = aiAnalysisRepository
                            .findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullOrderByIncidentEndTimeDesc(instance.getInstanceId());
                    
                    if (analyses.isEmpty()) {
                        return ResponseEntity.ok(Map.of(
                                "instanceId", instance.getInstanceId(),
                                "message", "No AI analyses found for this instance"
                        ));
                    }
                    
                    return ResponseEntity.ok(Map.of(
                            "instanceId", instance.getInstanceId(),
                            "nickname", instance.getNickname() != null ? instance.getNickname() : "",
                            "latestAnalysis", analyses.getFirst()
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/ai-analyses/top/{n}")
    public ResponseEntity<?> getTopNAiAnalyses(@PathVariable Long id,
                                               @PathVariable int n,
                                               @AuthenticationPrincipal UserDetails userDetails)
    {
        int limit = Math.clamp(n, 1, 50);
        
        return instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                .map(instance -> {
                    List<IncidentSnapshot> allAnalyses = aiAnalysisRepository
                            .findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullOrderByIncidentEndTimeDesc(instance.getInstanceId());
                    
                    // Manually limit results since JPA query doesn't support dynamic limit
                    List<IncidentSnapshot> topN = allAnalyses.stream()
                            .limit(limit)
                            .toList();
                    
                    return ResponseEntity.ok(Map.of(
                            "instanceId", instance.getInstanceId(),
                            "nickname", instance.getNickname() != null ? instance.getNickname() : "",
                            "requested", n,
                            "returned", topN.size(),
                            "totalAvailable", allAnalyses.size(),
                            "analyses", topN
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/ai-analyses/count")
    public ResponseEntity<?> getAiAnalysisCount(@PathVariable Long id,
                                                @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                .map(instance -> {
                    long count = aiAnalysisRepository
                            .countByInstanceEntity_InstanceIdAndAiAnalysisIsNotNull(instance.getInstanceId());
                    
                    return ResponseEntity.ok(Map.of(
                            "instanceId", instance.getInstanceId(),
                            "nickname", instance.getNickname() != null ? instance.getNickname() : "",
                            "totalAnalyses", count
                    ));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/ai-analyses/by-resolution/{resolution}")
    public ResponseEntity<?> getAiAnalysesByResolution(@PathVariable Long id,
                                                       @PathVariable String resolution,
                                                       @AuthenticationPrincipal UserDetails userDetails) {
        try {
            MonitorState resolutionState = MonitorState.valueOf(resolution.toUpperCase());
            
            return instanceRepository.findById(id)
                    .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                    .map(instance -> {
                        List<IncidentSnapshot> analyses = aiAnalysisRepository
                                .findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullAndResolutionOrderByIncidentEndTimeDesc(
                                        instance.getInstanceId(), 
                                        resolutionState
                                );
                        
                        return ResponseEntity.ok(Map.of(
                                "instanceId", instance.getInstanceId(),
                                "nickname", instance.getNickname() != null ? instance.getNickname() : "",
                                "resolution", resolution.toUpperCase(),
                                "totalAnalyses", analyses.size(),
                                "analyses", analyses
                        ));
                    })
                    .orElse(ResponseEntity.notFound().build());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid resolution type. Valid values: HEALTHY, SUSPECT, QUARANTINE, TERMINATED"
            ));
        }
    }

    @GetMapping("/ai-analyses/all")
    public ResponseEntity<?> getAllUserAiAnalyses(@AuthenticationPrincipal UserDetails userDetails)
    {
        var userInstances = instanceRepository.findByUserUsername(userDetails.getUsername());
        List<IncidentSnapshot> allAnalyses = userInstances.stream()
                .flatMap(instance -> aiAnalysisRepository
                        .findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullOrderByIncidentEndTimeDesc(instance.getInstanceId())
                        .stream())
                .toList();
        
        return ResponseEntity.ok(Map.of(
                "username", userDetails.getUsername(),
                "totalInstances", userInstances.size(),
                "totalAnalyses", allAnalyses.size(),
                "analyses", allAnalyses
        ));
    }

    @GetMapping("/ai-analyses/latest")
    public ResponseEntity<?> getLatestUserAiAnalysis(@AuthenticationPrincipal UserDetails userDetails)
    {
        var userInstances = instanceRepository.findByUserUsername(userDetails.getUsername());
        var latestAnalysis = userInstances.stream()
                .flatMap(instance -> aiAnalysisRepository
                        .findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullOrderByIncidentEndTimeDesc(instance.getInstanceId())
                        .stream()
                        .limit(1))
                .max((a, b) -> a.getIncidentEndTime().compareTo(b.getIncidentEndTime()));
        
        if (latestAnalysis.isEmpty()) {
            return ResponseEntity.ok(Map.of(
                    "username", userDetails.getUsername(),
                    "message", "No AI analyses found for any of your instances"
            ));
        }
        
        IncidentSnapshot latest = latestAnalysis.get();
        return ResponseEntity.ok(Map.of(
                "username", userDetails.getUsername(),
                "instanceId", latest.getInstanceEntity().getInstanceId(),
                "nickname", latest.getInstanceEntity().getNickname() != null 
                        ? latest.getInstanceEntity().getNickname() : "",
                "latestAnalysis", latest
        ));
    }
}

