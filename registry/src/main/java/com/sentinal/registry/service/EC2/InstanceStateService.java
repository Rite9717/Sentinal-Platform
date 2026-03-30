package com.sentinal.registry.service.EC2;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.repository.InstanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class InstanceStateService {

    private static final int MAX_SUSPECT_STRIKES = 3;
    private static final int MAX_QUARANTINE_COUNT = 5;
    private static final long QUARANTINE_DURATION_MS = 5 * 60 * 1000L; // 5 min

    private final EC2HealthService ec2HealthService;
    private final InstanceRepository instanceRepository;
    private final InstanceEventPublisher eventPublisher;

    public void evaluateHealth(InstanceEntity instance) {

        // Skip quarantined instances until their time is up
        if (instance.getState() == MonitorState.QUARANTINED) {
            if (System.currentTimeMillis() < instance.getQuarantineUntil()) {
                log.debug("Instance {} still quarantined, skipping", instance.getInstanceId());
                return;
            }
            // Quarantine lifted — move back to SUSPECT for re-evaluation
            log.info("Quarantine lifted for {}, re-evaluating", instance.getInstanceId());
            transitionTo(instance, MonitorState.SUSPECT);
        }

        // Run the actual AWS health check
        boolean healthy = performHealthCheck(instance);
        instance.setLastCheckedAt(System.currentTimeMillis());

        if (healthy) {
            handleHealthy(instance);
        } else {
            handleUnhealthy(instance);
        }

        instanceRepository.save(instance);
    }

    // ─── Transition Handlers ──────────────────────────────────────────────────

    private void handleHealthy(InstanceEntity instance) {
        if (instance.getState() != MonitorState.UP) {
            log.info("Instance {} recovered → UP", instance.getInstanceId());
            instance.setSuspectCount(0);
            transitionTo(instance, MonitorState.UP);
            eventPublisher.publish(instance, "Instance recovered and is UP");
        } else {
            instance.setSuspectCount(0); // reset strike counter
            log.debug("Instance {} is UP ✓", instance.getInstanceId());
        }
    }

    private void handleUnhealthy(InstanceEntity instance) {
        instance.setSuspectCount(instance.getSuspectCount() + 1);
        int strikes = instance.getSuspectCount();

        log.warn("Instance {} unhealthy — strike {}/{}",
                instance.getInstanceId(), strikes, MAX_SUSPECT_STRIKES);

        if (instance.getState() == MonitorState.UP) {
            // First failure — move to SUSPECT
            log.warn("Instance {} → SUSPECT (strike 1)", instance.getInstanceId());
            transitionTo(instance, MonitorState.SUSPECT);
            eventPublisher.publish(instance, "Instance failing health checks — marked SUSPECT");

        } else if (instance.getState() == MonitorState.SUSPECT) {

            if (strikes >= MAX_SUSPECT_STRIKES) {

                if (instance.getQuarantineCount() >= MAX_QUARANTINE_COUNT) {
                    // Too many quarantine cycles — terminate monitoring
                    log.error("Instance {} exceeded max quarantine cycles → TERMINATED",
                            instance.getInstanceId());
                    transitionTo(instance, MonitorState.TERMINATED);
                    eventPublisher.publish(instance, "Instance exceeded max quarantine cycles — TERMINATED");
                } else {
                    // Quarantine it
                    log.error("Instance {} exceeded suspect strikes → QUARANTINED",
                            instance.getInstanceId());
                    instance.setQuarantineCount(instance.getQuarantineCount() + 1);
                    instance.setQuarantineUntil(System.currentTimeMillis() + QUARANTINE_DURATION_MS);
                    transitionTo(instance, MonitorState.QUARANTINED);
                    eventPublisher.publish(instance,
                            "Instance quarantined for " + (QUARANTINE_DURATION_MS / 60000) + " minutes");
                }
            }
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private boolean performHealthCheck(InstanceEntity instance) {
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
            return healthy;
        } catch (Exception e) {
            instance.setLastError(e.getMessage());
            return false;
        }
    }

    private void transitionTo(InstanceEntity instance, MonitorState newState) {
        MonitorState oldState = instance.getState();
        instance.setState(newState);
        instance.setStateChangedAt(System.currentTimeMillis());
        log.info("Instance {} state: {} → {}", instance.getInstanceId(), oldState, newState);
    }
}


