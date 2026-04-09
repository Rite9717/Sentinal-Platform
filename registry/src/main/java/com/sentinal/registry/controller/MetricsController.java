package com.sentinal.registry.controller;

import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.metrics.PrometheusService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/instances")
@RequiredArgsConstructor
public class MetricsController
{
    private final PrometheusService prometheusService;
    private final InstanceRepository instanceRepository;

    @GetMapping("/{id}/metrics")
    public ResponseEntity<?> getInstanceMetrics(@PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails)
    {
        return instanceRepository.findById(id)
                .filter(instance -> instance.getUser().getUsername()
                        .equals(userDetails.getUsername()))
                .map(instance -> ResponseEntity.ok(
                        prometheusService.getAllMetrics(instance.getInstanceId())
                ))
                .orElse(ResponseEntity.notFound().build());
    }
}
