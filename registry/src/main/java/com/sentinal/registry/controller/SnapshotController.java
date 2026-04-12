package com.sentinal.registry.controller;

import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
public class SnapshotController
{
    private final MetricSnapshotRepository snapshotRepository;
    private final InstanceRepository instanceRepository;

    @GetMapping("/{id}/snapshots")
    public ResponseEntity<?> getSnapshot(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails)
    {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .map(i -> {
                    List<MetricsSnapshot> snapshots = snapshotRepository.findTop10ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(
                            i.getInstanceId()
                    );
                    return  ResponseEntity.ok(snapshots);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/snapshots/{snapshotId}/ai-context")
    public ResponseEntity<?> getAiContext(@PathVariable Long id, @PathVariable Long snapshotId,@AuthenticationPrincipal UserDetails userDetails)
    {
        return instanceRepository.findById(id)
                .filter(i -> i.getUser().getUsername().equals(userDetails.getUsername()))
                .flatMap(i -> snapshotRepository.findById(snapshotId))
                .map(snap -> ResponseEntity.ok(snap.getAiContext()))
                .orElse(ResponseEntity.notFound().build());
    }
}
