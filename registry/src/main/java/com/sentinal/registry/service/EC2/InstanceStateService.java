package com.sentinal.registry.service.EC2;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.metrics.IncidentSnapshotService;
import com.sentinal.registry.service.metrics.MetricAnomalyService;
import com.sentinal.registry.service.metrics.MetricsSnapshotService;
import com.sentinal.registry.service.metrics.PrometheusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
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
    private final MetricAnomalyService anomalyService;
    private final PrometheusService prometheusService;
    private final IncidentSnapshotService incidentSnapshotService;

    private Map<String, Object> performHealthCheck(InstanceEntity instance) {
        try {
            Map<String, Object> health = ec2HealthService.getInstanceHealth(
                    instance.getInstanceId(),
                    instance.getRoleArn(),
                    instance.getExternalId(),
                    instance.getRegion()
            );
            Map<String, Object> metrics = prometheusService.getAllMetrics(
                    instance.getInstanceId(),
                    instance.getState()
            );

            boolean healthy = Boolean.TRUE.equals(health.get("healthy"));
            if (!healthy) {
                instance.setLastError((String) health.getOrDefault("error", "Health check failed"));
            } else {
                instance.setLastError(null);
            }
            health.putAll(metrics);
            return health;
        } catch (Exception e) {
            instance.setLastError(e.getMessage());
            Map<String, Object> fallback = new HashMap<>();
            fallback.put("healthy", false);
            fallback.put("instanceState", "unknown");
            fallback.put("cpu", null);
            fallback.put("memory", null);
            fallback.put("disk", null);
            fallback.put("networkIn", null);
            fallback.put("networkOut", null);
            fallback.put("load", null);
            fallback.put("isValid", false);
            fallback.put("status", "error");
            fallback.put("error", e.getMessage());
            return fallback;
        }
    }

    public void evaluateHealth(InstanceEntity instance)
    {
        Map<String, Object> health = performHealthCheck(instance);
        instance.setLastCheckedAt(System.currentTimeMillis());
        boolean healthy = Boolean.TRUE.equals(health.get("healthy"));
        MonitorState previousState = instance.getState();

        MetricAnomalyService.DetectionResult anomalyResult = anomalyService.detectAndPersist(instance, health);

        boolean shouldContinueEvaluation = true;
        if (instance.getState() == MonitorState.QUARANTINED) 
        {
            if (healthy) {
                recoverToUp(
                        instance,
                        health,
                        "Recovered during quarantine",
                        "Instance recovered during quarantine — back UP"
                );
                shouldContinueEvaluation = false;
            }
            else if (System.currentTimeMillis() < instance.getQuarantineUntil()) {
                incidentSnapshotService.appendInterval(
                        instance,
                        MonitorState.QUARANTINED,
                        "QUARANTINED -> QUARANTINED",
                        "Instance in quarantine and is being observed",
                        health
                );
                log.debug("Instance {} still quarantined and unhealthy, skipping", instance.getInstanceId());
                shouldContinueEvaluation = false;
            } else {
                log.info("Quarantine expired for {} and instance still unhealthy, re-evaluating",
                        instance.getInstanceId());
                instance.setSuspectCount(0);
                transitionTo(instance, MonitorState.SUSPECT);
            }
        }

        if (shouldContinueEvaluation) {
            if (healthy) {
                handleHealthy(instance, health);
            } else {
                handleUnhealthy(instance, health);
            }
        }

        boolean stateChanged = previousState != instance.getState();
        snapshotService.captureMonitoringSnapshot(
                instance,
                health,
                healthy,
                stateChanged,
                anomalyResult.hasLifecycleChange()
        );
        instanceRepository.save(instance);
    }

    private void handleHealthy(InstanceEntity instance, Map<String, Object> metrics)
    {
        if (instance.getState() != MonitorState.UP)
        {
            recoverToUp(
                    instance,
                    metrics,
                    "Instance recovered",
                    "Instance recovered and is UP"
            );
        } else
        {
            instance.setSuspectCount(0); // reset strike counter
            log.debug("Instance {} is UP ✓", instance.getInstanceId());
        }
    }

    private void handleUnhealthy(InstanceEntity instance, Map<String, Object> health)
    {
        instance.setSuspectCount(instance.getSuspectCount() + 1);
        int strikes = instance.getSuspectCount();
        int maxStrikes = instance.getMaxSuspectStrikes();
        int maxCycles = instance.getMaxQuarantineCycles();
        long quarantineMS = instance.getQuarantineDurationMinutes() * 60 * 1000L;
        String errorMSG = health.get("error") != null
                ? health.get("error").toString()
                : health.get("reason") != null
                ? health.get("reason").toString()
                : "Health check failed";

        log.warn("Instance {} unhealthy — strike {}/{}",
                instance.getInstanceId(), strikes, maxStrikes);

        if (instance.getState() == MonitorState.UP)
        {
            Long lastGoodSnapshotId = snapshotService.findLatestValidSnapshotId(instance.getInstanceId()).orElse(null);
            log.warn("Instance {} → SUSPECT (strike {})", instance.getInstanceId(), strikes);
            transitionTo(instance, MonitorState.SUSPECT);
            incidentSnapshotService.onIncidentStart(
                    instance,
                    MonitorState.SUSPECT,
                    "UP -> SUSPECT",
                    errorMSG,
                    lastGoodSnapshotId,
                    health
            );
            eventPublisher.publish(instance, "Instance failing health checks — marked SUSPECT");
        }
        else if (instance.getState() == MonitorState.SUSPECT)
        {
            incidentSnapshotService.appendInterval(
                    instance,
                    MonitorState.SUSPECT,
                    "SUSPECT -> SUSPECT",
                    errorMSG,
                    health
            );
            if (strikes >= maxStrikes)
            {
                if (instance.getQuarantineCount() >= maxCycles)
                {
                    MonitorState previous = instance.getState();
                    log.error("Instance {} exceeded max quarantine cycles → TERMINATED",
                            instance.getInstanceId());
                    transitionTo(instance, MonitorState.TERMINATED);
                    incidentSnapshotService.onIncidentClose(
                            instance,
                            MonitorState.TERMINATED,
                            previous.name() + " -> TERMINATED",
                            errorMSG,
                            health
                    );
                    eventPublisher.publish(instance, "Instance exceeded max quarantine cycles — TERMINATED");
                } else {
                    MonitorState previous = instance.getState();
                    log.error("Instance {} exceeded suspect strikes → QUARANTINED",
                            instance.getInstanceId());
                    instance.setQuarantineCount(instance.getQuarantineCount() + 1);
                    instance.setQuarantineUntil(System.currentTimeMillis() + quarantineMS);
                    transitionTo(instance, MonitorState.QUARANTINED);
                    incidentSnapshotService.appendInterval(
                            instance,
                            MonitorState.QUARANTINED,
                            previous.name() + " -> QUARANTINED",
                            errorMSG,
                            health
                    );
                    eventPublisher.publish(instance,
                            "Instance quarantined for " + instance.getQuarantineDurationMinutes() + "minutes");
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

    private void transitionTo(InstanceEntity instance, MonitorState newState) {
        MonitorState oldState = instance.getState();
        instance.setState(newState);
        instance.setStateChangedAt(System.currentTimeMillis());
        log.info("Instance {} state: {} → {}", instance.getInstanceId(), oldState, newState);
    }

    private void recoverToUp(
            InstanceEntity instance,
            Map<String, Object> metrics,
            String triggerReason,
            String eventMessage
    ) {
        MonitorState previous = instance.getState();
        log.info("Instance {} recovered from {} → UP", instance.getInstanceId(), previous);
        transitionTo(instance, MonitorState.UP);
        incidentSnapshotService.onIncidentClose(
                instance,
                MonitorState.UP,
                previous.name() + " -> UP",
                triggerReason,
                metrics
        );
        instance.setSuspectCount(0);
        instance.setQuarantineCount(0);
        instance.setQuarantineUntil(0L);
        eventPublisher.publish(instance, eventMessage);
    }
}
