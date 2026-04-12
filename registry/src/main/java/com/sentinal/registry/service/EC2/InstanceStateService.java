package com.sentinal.registry.service.EC2;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.metrics.MetricsSnapshotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.ec2.endpoints.internal.Value;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class InstanceStateService
{
    private final EC2HealthService ec2HealthService;
    private final InstanceRepository instanceRepository;
    private final InstanceEventPublisher eventPublisher;
    private final MetricsSnapshotService snapshotService;

    public void evaluateHealth(InstanceEntity instance)
    {
        if (instance.getState() == MonitorState.QUARANTINED) {
            Map<String, Object> health = performHealthCheck(instance);
            boolean healthy = Boolean.TRUE.equals(health.get("healthy"));
            if (healthy) {
                log.info("Instance {} recovered during quarantine → UP", instance.getInstanceId());
                instance.setSuspectCount(0);
                instance.setQuarantineUntil(0L); // clear the timer
                transitionTo(instance, MonitorState.UP);
                eventPublisher.publish(instance, "Instance recovered during quarantine — back UP");
                instanceRepository.save(instance);
                return;
            }

            if (System.currentTimeMillis() < instance.getQuarantineUntil()) {
                log.debug("Instance {} still quarantined and unhealthy, skipping", instance.getInstanceId());
                return;
            }
            log.info("Quarantine expired for {} and instance still unhealthy, re-evaluating",
                    instance.getInstanceId());
            instance.setSuspectCount(0);
            transitionTo(instance, MonitorState.SUSPECT);
        }
        Map<String, Object> health = performHealthCheck(instance);
        boolean healthy = Boolean.TRUE.equals(health.get("healthy"));
        instance.setLastCheckedAt(System.currentTimeMillis());

        if (healthy) {
            handleHealthy(instance);
        } else {
            handleUnhealthy(instance, health);
        }

        instanceRepository.save(instance);
    }

    private void handleHealthy(InstanceEntity instance) {
        if (instance.getState() != MonitorState.UP) {
            log.info("Instance {} recovered → UP", instance.getInstanceId());
            instance.setSuspectCount(0);
            instance.setQuarantineCount(0);
            instance.setQuarantineUntil(0L);
            transitionTo(instance, MonitorState.UP);
            eventPublisher.publish(instance, "Instance recovered and is UP");
        } else {
            instance.setSuspectCount(0); // reset strike counter
            log.debug("Instance {} is UP ✓", instance.getInstanceId());
        }
    }

    private void handleUnhealthy(InstanceEntity instance, Map<String, Object> health) {
        instance.setSuspectCount(instance.getSuspectCount() + 1);
        int strikes = instance.getSuspectCount();
        int maxStrikes = instance.getMaxSuspectStrikes();
        int maxCycles = instance.getMaxQuarantineCycles();
        long quarantineMS = instance.getQuarantineDurationMinutes() * 60 * 1000L;
        String errorMSG = (String) health.getOrDefault("error", "Health check failed");

        log.warn("Instance {} unhealthy — strike {}/{}",
                instance.getInstanceId(), strikes, maxStrikes);

        if (instance.getState() == MonitorState.UP)
        {
            log.warn("Instance {} → SUSPECT (strike 1)", instance.getInstanceId());
            transitionTo(instance, MonitorState.SUSPECT);
            eventPublisher.publish(instance, "Instance failing health checks — marked SUSPECT");
            snapshotService.captureSnapshot(instance, "SUSPECT", errorMSG);

        }
        else if (instance.getState() == MonitorState.SUSPECT)
        {
            if (strikes >= maxStrikes)
            {
                if (instance.getQuarantineCount() >= maxCycles)
                {
                    log.error("Instance {} exceeded max quarantine cycles → TERMINATED",
                            instance.getInstanceId());
                    transitionTo(instance, MonitorState.TERMINATED);
                    eventPublisher.publish(instance, "Instance exceeded max quarantine cycles — TERMINATED");
                    snapshotService.captureSnapshot(instance,"TERMINATED", errorMSG);
                } else {
                    log.error("Instance {} exceeded suspect strikes → QUARANTINED",
                            instance.getInstanceId());
                    instance.setQuarantineCount(instance.getQuarantineCount() + 1);
                    instance.setQuarantineUntil(System.currentTimeMillis() + quarantineMS);
                    transitionTo(instance, MonitorState.QUARANTINED);
                    eventPublisher.publish(instance,
                            "Instance quarantined for " + instance.getQuarantineDurationMinutes() + "minutes");
                    snapshotService.captureSnapshot(instance, "Quarantined", errorMSG);
                    String instanceState = (String) health.getOrDefault("instanceState", "unknown");
                    triggerAutoReboot(instance, instanceState);
                }
            }
        }
    }

    private void triggerAutoReboot(InstanceEntity instance, String instanceState)
    {
        Thread.ofVirtual().start(() ->
        {
                try {
                    log.info("Triggering auto-reboot for instance {} (state: {})", instance.getInstanceId(), instanceState);
                    Map<String, Object> result;
                    if ("stopped".equals(instanceState)) {
                        log.info("Instance {} is stopped, starting instead of rebooting", instance.getInstanceId());
                        result = ec2HealthService.startInstance(
                                instance.getInstanceId(),
                                instance.getRoleArn(),
                                instance.getExternalId(),
                                instance.getRegion()
                        );
                    } else {
                        log.info("Instance {} is running but unhealthy, rebooting", instance.getInstanceId());
                        result = ec2HealthService.rebootInstance(
                                instance.getInstanceId(),
                                instance.getRoleArn(),
                                instance.getExternalId(),
                                instance.getRegion()
                        );
                    }
                    if (Boolean.TRUE.equals(result.get("success"))) {
                        log.info("Auto-recovery command sent for instance {} (action: {})",
                                instance.getInstanceId(), result.get("action"));
                        eventPublisher.publish(instance,
                                "Auto-recovery triggered: " + result.get("action") +
                                        " — will re-evaluate in " + instance.getQuarantineDurationMinutes() + " minutes");
                    } else {
                        log.error("Auto-reboot failed for instance {}: {}",
                                instance.getInstanceId(), result.get("error"));
                        eventPublisher.publish(instance, "Auto-reboot failed: " + result.get("error"));
                    }
                } catch (Exception e) {
                    log.error("Auto-recovery exception for instance {}: {}",
                            instance.getInstanceId(), e.getMessage());
                }
        });
    }

    private Map<String, Object> performHealthCheck(InstanceEntity instance) {
        try {
            Map<String, Object> health = ec2HealthService.getInstanceHealth(
                    instance.getInstanceId(),
                    instance.getRoleArn(),
                    instance.getExternalId(),
                    instance.getRegion()
            );
            boolean healthy = Boolean.TRUE.equals(health.get("healthy"));
            if (!healthy) {
                instance.setLastError((String) health.getOrDefault("error", "Health check failed"));
            } else {
                instance.setLastError(null);
            }
            return health;
        } catch (Exception e) {
            instance.setLastError(e.getMessage());
            return Map.of("healthy", false, "instanceState", "unknown");
        }
    }

    private void transitionTo(InstanceEntity instance, MonitorState newState) {
        MonitorState oldState = instance.getState();
        instance.setState(newState);
        instance.setStateChangedAt(System.currentTimeMillis());
        log.info("Instance {} state: {} → {}", instance.getInstanceId(), oldState, newState);
    }
}


