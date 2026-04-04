package com.sentinal.registry.controller;

import com.sentinal.registry.dto.instance.RegisterInstanceRequest;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.service.EC2.InstanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
public class InstanceController
{
    private final InstanceService instanceService;

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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteInstance(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails)
    {
        instanceService.deleteInstance(id, userDetails.getUsername());
        return ResponseEntity.noContent().build();
    }
}
