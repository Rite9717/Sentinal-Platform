package com.sentinal.registry.service.EC2;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.LatestMetrics;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.service.metrics.IncidentSnapshotService;
import com.sentinal.registry.service.metrics.LatestMetricsService;
import com.sentinal.registry.service.metrics.MetricAnomalyService;
import com.sentinal.registry.service.metrics.MetricsSnapshotService;
import com.sentinal.registry.service.metrics.PrometheusService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InstanceStateServiceTest {

    @Mock
    private EC2HealthService ec2HealthService;
    @Mock
    private InstanceRepository instanceRepository;
    @Mock
    private IncidentSnapshotRepository incidentRepository;
    @Mock
    private InstanceEventPublisher eventPublisher;
    @Mock
    private MetricsSnapshotService snapshotService;
    @Mock
    private MetricAnomalyService anomalyService;
    @Mock
    private LatestMetricsService latestMetricsService;
    @Mock
    private PrometheusService prometheusService;
    @Mock
    private IncidentSnapshotService incidentSnapshotService;

    @InjectMocks
    private InstanceStateService instanceStateService;

    @Test
    void normalHealthyCheck_shouldUpdateLatestMetricsWithoutCreatingHistoricalSnapshot() {
        InstanceEntity instance = baseInstance(1L, "i-ok", MonitorState.UP);
        Map<String, Object> health = new HashMap<>();
        health.put("healthy", true);
        health.put("instanceState", "running");
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("isValid", true);
        metrics.put("cpu", 33.0d);
        metrics.put("memory", 45.0d);
        metrics.put("disk", 52.0d);
        metrics.put("networkIn", 200.0d);
        metrics.put("networkOut", 180.0d);

        when(ec2HealthService.getInstanceHealth(anyString(), anyString(), anyString(), anyString())).thenReturn(health);
        when(prometheusService.getAllMetrics(anyString(), any())).thenReturn(metrics);
        when(latestMetricsService.findByInstanceId(1L)).thenReturn(Optional.of(LatestMetrics.builder().isValid(true).build()));
        when(incidentRepository.findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc("i-ok"))
                .thenReturn(Optional.empty());
        when(anomalyService.processMetrics(any(), anyMap(), any(), any()))
                .thenReturn(new MetricAnomalyService.DetectionResult(false, false, List.of()));

        instanceStateService.evaluateHealth(instance);

        verify(latestMetricsService).upsert(eq(instance), anyMap());
        verify(snapshotService, never()).saveStateChangeSnapshot(any(), anyMap(), anyString(), any());
        verify(incidentSnapshotService, never()).onIncidentStart(any(), any(), anyString(), anyString(), any(), anyMap());
        verify(instanceRepository).save(instance);
        assertThat(instance.getState()).isEqualTo(MonitorState.UP);
    }

    @Test
    void unhealthyFromUp_shouldCreateIncidentUsingLastGoodSnapshotLink() {
        InstanceEntity instance = baseInstance(2L, "i-bad", MonitorState.UP);
        Map<String, Object> health = new HashMap<>();
        health.put("healthy", false);
        health.put("instanceState", "running");
        health.put("error", "Status check failed");
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("isValid", false);
        metrics.put("cpu", null);
        metrics.put("memory", null);
        metrics.put("disk", null);
        metrics.put("networkIn", null);
        metrics.put("networkOut", null);
        metrics.put("reason", "Prometheus returned no metric samples for this check");

        when(ec2HealthService.getInstanceHealth(anyString(), anyString(), anyString(), anyString())).thenReturn(health);
        when(prometheusService.getAllMetrics(anyString(), any())).thenReturn(metrics);
        when(latestMetricsService.findByInstanceId(2L)).thenReturn(Optional.empty());
        when(anomalyService.processMetrics(any(), anyMap(), any(), any()))
                .thenReturn(new MetricAnomalyService.DetectionResult(false, false, List.of()));
        when(snapshotService.findLatestValidSnapshotId(2L)).thenReturn(Optional.of(664L));
        when(incidentRepository.findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc("i-bad"))
                .thenReturn(Optional.empty(), Optional.of(IncidentSnapshot.builder().id(99L).build()));

        instanceStateService.evaluateHealth(instance);

        ArgumentCaptor<Long> lastGoodCaptor = ArgumentCaptor.forClass(Long.class);
        verify(incidentSnapshotService).onIncidentStart(
                eq(instance),
                eq(MonitorState.SUSPECT),
                eq("UP -> SUSPECT"),
                anyString(),
                lastGoodCaptor.capture(),
                anyMap()
        );
        assertThat(lastGoodCaptor.getValue()).isEqualTo(664L);
        assertThat(instance.getState()).isEqualTo(MonitorState.SUSPECT);
        assertThat(instance.getSuspectCount()).isEqualTo(1);
    }

    private InstanceEntity baseInstance(Long id, String instanceId, MonitorState state) {
        return InstanceEntity.builder()
                .id(id)
                .instanceId(instanceId)
                .region("us-east-1")
                .roleArn("arn:aws:iam::123:role/Sentinel")
                .externalId("ext")
                .state(state)
                .quarantineDurationMinutes(1)
                .maxSuspectStrikes(5)
                .maxQuarantineCycles(3)
                .suspectCount(0)
                .quarantineCount(0)
                .quarantineUntil(0L)
                .build();
    }
}
