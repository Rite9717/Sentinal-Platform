package com.sentinal.registry.controller;

import com.sentinal.registry.dto.instance.RegisterInstanceRequest;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.EC2.InstanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
public class InstanceController
{
    private final InstanceService instanceService;
    private final InstanceRepository instanceRepository;

    @PostMapping("/register")
    public ResponseEntity<InstanceEntity> register(@RequestBody RegisterInstanceRequest request, @AuthenticationPrincipal UserDetails userDetails)
    {
        return ResponseEntity.ok(instanceService.registerInstance(request,userDetails.getUsername()));
    }

    @GetMapping
    public ResponseEntity<List<InstanceEntity>> getMyInstances(@AuthenticationPrincipal UserDetails userDetails)
    {
        return ResponseEntity.ok(instanceService.getUserInstances(userDetails.getUsername()));
    }

    @PostMapping("/{id}/reset")
    public ResponseEntity<?> resetInstance(@PathVariable Long id,@AuthenticationPrincipal UserDetails userDetails)
    {
        return instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername().equals(userDetails.getUsername()))
                .map(instance -> {
                    instance.setState(MonitorState.UP);
                    instance.setSuspectCount(0);
                    instance.setQuarantineCount(0);
                    instance.setQuarantineUntil(0L);
                    instance.setLastError(null);
                    instance.setMaxQuarantineCycles(2);
                    instanceRepository.save(instance);
                    return ResponseEntity.ok(Map.of("message", "Instance reset to UP"));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInstance(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails)
    {
        instanceService.deleteInstance(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }
}
