package com.sentinal.registry.controller;

import com.sentinal.registry.dto.ai.AgenticAiAnalysisRequest;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.ai.AiAnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/ai/agenticai")
@RequiredArgsConstructor
public class AgenticAiController {

    private final InstanceRepository instanceRepository;
    private final IncidentSnapshotRepository incidentSnapshotRepository;
    private final AiAnalysisService aiAnalysisService;

    @PostMapping("/analyse")
    public ResponseEntity<?> analyseSnapshot(@RequestBody AgenticAiAnalysisRequest request,
                                             @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "error", "Authentication required",
                    "message", "Please log in again before starting AI analysis"
            ));
        }

        if (request.getInstanceId() == null || request.getSnapshotId() == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "instanceId and snapshotId are required"
            ));
        }

        if (!aiAnalysisService.isAiServiceAvailable()) {
            return ResponseEntity.status(503).body(Map.of(
                    "error", "AI analysis service is currently unavailable"
            ));
        }

        return instanceRepository.findById(request.getInstanceId())
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                .flatMap(instance -> incidentSnapshotRepository.findById(request.getSnapshotId())
                        .filter(snapshot -> snapshot.getInstanceEntity().getId().equals(instance.getId()))
                        .map(snapshot -> {
                            var response = aiAnalysisService.analyzeIncident(snapshot, request.getPrompt());
                            snapshot.setAiAnalysis(response.getCombinedAnalysis());
                            incidentSnapshotRepository.save(snapshot);
                            return ResponseEntity.ok(response);
                        }))
                .orElse(ResponseEntity.notFound().build());
    }
}
