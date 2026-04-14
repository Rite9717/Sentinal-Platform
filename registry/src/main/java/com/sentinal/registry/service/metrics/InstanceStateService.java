package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.EC2.EC2HealthService;
import com.sentinal.registry.service.EC2.InstanceEventPublisher;
import com.sentinal.registry.service.metrics.IncidentSnapshotService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class InstanceStateService {

    private final EC2HealthService ec2HealthService;
    private final InstanceRepository      instanceRepository;
    private final InstanceEventPublisher eventPublisher;
    private final IncidentSnapshotService snapshotService;   // <-- inject

    public void evaluateHealth(InstanceEntity instance) {
        if (instance.getState() == MonitorState.QUARANTINED) {
            if (System.currentTimeMillis() < instance.getQuarantineUntil()) {
                log.debug("Instance {} still quarantined, skipping", instance.getInstanceId());
                return;
            }
            log.info("Quarantine lifted for {}, re-evaluating", instance.getInstanceId());
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

    // ------------------------------------------------------------------
    // Healthy path — closes any open incident when the instance recovers
    // ------------------------------------------------------------------
    private void handleHealthy(InstanceEntity instance) {
        if (instance.getState() != MonitorState.UP) {
            log.info("Instance {} recovered → UP", instance.getInstanceId());
            instance.setSuspectCount(0);
            transitionTo(instance, MonitorState.UP);
            eventPublisher.publish(instance, "Instance recovered and is UP");

            // CLOSE the incident: append final "UP" reading and seal the snapshot
            snapshotService.onIncidentClose(instance, MonitorState.RECOVERED,
                    "Instance passed health check — incident resolved");

        } else {
            instance.setSuspectCount(0);
            log.debug("Instance {} is UP ✓", instance.getInstanceId());
        }
    }

    // ------------------------------------------------------------------
    // Unhealthy path — opens / appends / closes incidents as state changes
    // ------------------------------------------------------------------
    private void handleUnhealthy(InstanceEntity instance, Map<String, Object> health) {
        instance.setSuspectCount(instance.getSuspectCount() + 1);
        int strikes    = instance.getSuspectCount();
        int maxStrikes = instance.getMaxSuspectStrikes();
        int maxCycles  = instance.getMaxQuarantineCycles();
        long quarantineMS = instance.getQuarantineDurationMinutes() * 60 * 1000L;
        String errorMsg = (String) health.getOrDefault("error", "Health check failed");

        log.warn("Instance {} unhealthy — strike {}/{}", instance.getInstanceId(), strikes, maxStrikes);

        if (instance.getState() == MonitorState.UP) {
            // ── First failure: UP → SUSPECT ──────────────────────────────────
            transitionTo(instance, MonitorState.SUSPECT);
            eventPublisher.publish(instance, "Instance failing health checks — marked SUSPECT");

            // OPEN a brand-new incident and record the first metrics interval
            snapshotService.onIncidentStart(instance,
                    String.format("strike 1/%d — %s", maxStrikes, errorMsg));

        } else if (instance.getState() == MonitorState.SUSPECT) {
            if (strikes < maxStrikes) {
                // ── Still suspect, accumulating strikes ──────────────────────
                // Append another interval — metrics may have changed
                snapshotService.appendInterval(instance, MonitorState.SUSPECT,
                        String.format("strike %d/%d — %s", strikes, maxStrikes, errorMsg));

            } else {
                // ── Max strikes reached ──────────────────────────────────────
                if (instance.getQuarantineCount() >= maxCycles) {
                    // TERMINATED
                    log.error("Instance {} exceeded max quarantine cycles → TERMINATED",
                            instance.getInstanceId());
                    transitionTo(instance, MonitorState.TERMINATED);
                    eventPublisher.publish(instance, "Instance exceeded max quarantine cycles — TERMINATED");

                    // CLOSE the incident with TERMINATED resolution
                    snapshotService.onIncidentClose(instance, MonitorState.TERMINATED,
                            String.format("exceeded %d quarantine cycles — %s", maxCycles, errorMsg));

                } else {
                    // QUARANTINED
                    log.error("Instance {} exceeded suspect strikes → QUARANTINED",
                            instance.getInstanceId());
                    instance.setQuarantineCount(instance.getQuarantineCount() + 1);
                    instance.setQuarantineUntil(System.currentTimeMillis() + quarantineMS);
                    transitionTo(instance, MonitorState.QUARANTINED);
                    eventPublisher.publish(instance,
                            "Instance quarantined for " + instance.getQuarantineDurationMinutes() + " minutes");

                    // APPEND a QUARANTINED interval (incident stays open — may recover later)
                    snapshotService.appendInterval(instance, MonitorState.QUARANTINED,
                            String.format("quarantine cycle %d/%d — %s",
                                    instance.getQuarantineCount(), maxCycles, errorMsg));

                    String instanceState = (String) health.getOrDefault("instanceState", "unknown");
                    triggerAutoReboot(instance, instanceState);
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Everything below is unchanged from your original code
    // ------------------------------------------------------------------
    private void triggerAutoReboot(InstanceEntity instance, String instanceState) {
        Thread.ofVirtual().start(() -> {
            try {
                Map<String, Object> result;
                if ("stopped".equals(instanceState)) {
                    result = ec2HealthService.startInstance(
                            instance.getInstanceId(), instance.getRoleArn(),
                            instance.getExternalId(), instance.getRegion());
                } else {
                    result = ec2HealthService.rebootInstance(
                            instance.getInstanceId(), instance.getRoleArn(),
                            instance.getExternalId(), instance.getRegion());
                }
                if (Boolean.TRUE.equals(result.get("success"))) {
                    eventPublisher.publish(instance,
                            "Auto-recovery triggered: " + result.get("action") +
                                    " — will re-evaluate in " + instance.getQuarantineDurationMinutes() + " minutes");
                } else {
                    eventPublisher.publish(instance, "Auto-reboot failed: " + result.get("error"));
                }
            } catch (Exception e) {
                log.error("Auto-recovery exception for {}: {}", instance.getInstanceId(), e.getMessage());
            }
        });
    }

    private Map<String, Object> performHealthCheck(InstanceEntity instance) {
        try {
            Map<String, Object> health = ec2HealthService.getInstanceHealth(
                    instance.getInstanceId(), instance.getRoleArn(),
                    instance.getExternalId(), instance.getRegion());
            instance.setLastError(Boolean.TRUE.equals(health.get("healthy"))
                    ? null : (String) health.getOrDefault("error", "Health check failed"));
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