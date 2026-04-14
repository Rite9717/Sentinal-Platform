package com.sentinal.registry.controller;

import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
public class SnapshotController {

    private final IncidentSnapshotRepository incidentRepository;
    private final InstanceRepository instanceRepository;

    @GetMapping("/{id}/incidents")
    public ResponseEntity<?> getIncidents(@PathVariable Long id,
                                          @AuthenticationPrincipal UserDetails userDetails) {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .map(i -> {
                    List<IncidentSnapshot> incidents = incidentRepository
                            .findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNotNullOrderByIncidentStartTimeDesc(
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
                        .findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNull(i.getInstanceId())
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
                    incidentRepository.save(incident);
                    return ResponseEntity.ok().build();
                })
                .orElse(ResponseEntity.notFound().build());
    }
}