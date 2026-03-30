package com.sentinal.registry.service.scheduler;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.EC2.InstanceStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;


import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InstanceHealthScheduler {

    private final InstanceRepository instanceRepository;
    private final InstanceStateService stateService;

    @Scheduled(fixedDelay = 15000) // every 15 seconds
    public void checkAllInstances() {
        List<InstanceEntity> instances = instanceRepository
                .findByStateNot(MonitorState.TERMINATED);

        log.info("Health check tick — checking {} instances", instances.size());

        instances.forEach(instance -> {
            try {
                stateService.evaluateHealth(instance);
            } catch (Exception e) {
                log.error("Error checking instance {}: {}", instance.getInstanceId(), e.getMessage());
            }
        });
    }
}