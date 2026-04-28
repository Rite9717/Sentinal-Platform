package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.*;
import com.sentinal.registry.repository.MetricAnomalyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MetricAnomalyServiceTest {

    @Mock
    private MetricAnomalyRepository anomalyRepository;

    @Mock
    private MetricsSnapshotService snapshotService;

    @Mock
    private MetricLifecycleSnapshotService lifecycleSnapshotService;

    @InjectMocks
    private MetricAnomalyService metricAnomalyService;

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(metricAnomalyService, "suddenSpikePercent", 20.0d);
        ReflectionTestUtils.setField(metricAnomalyService, "spikeSnapshotIntervalSeconds", 60L);
    }

    @Test
    void suddenSpike_shouldCreatePreSpikeAndSpikeStartSnapshotsWithSingleActiveAnomaly() {
        InstanceEntity instance = instance(1L, "i-1");
        LatestMetrics previous = LatestMetrics.builder().isValid(true).cpuUsage(38.0d).memoryUsage(30.0d).diskUsage(40.0d).build();
        Map<String, Object> metrics = metrics(82.0d, 31.0d, 41.0d);

        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                1L, MetricName.CPU, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                1L, MetricName.MEMORY, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                1L, MetricName.DISK, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.save(any(MetricAnomaly.class))).thenAnswer(invocation -> {
            MetricAnomaly anomaly = invocation.getArgument(0);
            if (anomaly.getId() == null) {
                anomaly.setId(10L);
            }
            return anomaly;
        });

        MetricsSnapshot pre = MetricsSnapshot.builder().Id(100L).build();
        MetricsSnapshot start = MetricsSnapshot.builder().Id(101L).build();
        when(snapshotService.savePreSpikeSnapshot(any(), any(), anyString(), any(), any())).thenReturn(pre);
        when(snapshotService.saveEventSnapshot(any(), eq(MetricSnapshotType.SPIKE_START), anyMap(), anyString(), any(), any()))
                .thenReturn(start);

        MetricAnomalyService.DetectionResult result = metricAnomalyService.processMetrics(instance, metrics, previous, null);

        assertThat(result.lifecycleChanged()).isTrue();
        assertThat(result.anomalyIds()).contains(10L);
        verify(snapshotService, times(1)).savePreSpikeSnapshot(any(), any(), contains("Pre-spike baseline"), any(), isNull());
        verify(snapshotService, times(1)).saveEventSnapshot(any(), eq(MetricSnapshotType.SPIKE_START), anyMap(), contains("spike started"), any(), isNull());
    }

    @Test
    void sustainedSpike_shouldUpdateExistingAnomalyWithoutCreatingDuplicate() {
        InstanceEntity instance = instance(2L, "i-2");
        LatestMetrics previous = LatestMetrics.builder().isValid(true).cpuUsage(91.0d).memoryUsage(42.0d).diskUsage(55.0d).build();
        Map<String, Object> metrics = metrics(92.0d, 42.0d, 55.0d);

        MetricAnomaly active = MetricAnomaly.builder()
                .id(20L)
                .instanceEntity(instance)
                .metricName(MetricName.CPU)
                .status(AnomalyStatus.ACTIVE)
                .peakValue(95.0d)
                .lastSeenAt(LocalDateTime.now())
                .startedAt(LocalDateTime.now().minusMinutes(2))
                .build();

        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                2L, MetricName.CPU, AnomalyStatus.ACTIVE)).thenReturn(Optional.of(active));
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                2L, MetricName.MEMORY, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                2L, MetricName.DISK, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.save(any(MetricAnomaly.class))).thenAnswer(invocation -> invocation.getArgument(0));

        MetricAnomalyService.DetectionResult result = metricAnomalyService.processMetrics(instance, metrics, previous, null);

        assertThat(result.updated()).isTrue();
        assertThat(result.lifecycleChanged()).isFalse();
        verify(snapshotService, never()).savePreSpikeSnapshot(any(), any(), anyString(), any(), any());
        verify(snapshotService, never()).saveEventSnapshot(any(), eq(MetricSnapshotType.SPIKE_START), anyMap(), anyString(), any(), any());
    }

    @Test
    void recovery_shouldResolveActiveAnomalyAndCreateRecoverySnapshot() {
        InstanceEntity instance = instance(3L, "i-3");
        LatestMetrics previous = LatestMetrics.builder().isValid(true).cpuUsage(48.0d).memoryUsage(30.0d).diskUsage(40.0d).build();
        Map<String, Object> metrics = metrics(50.0d, 31.0d, 41.0d);

        MetricAnomaly active = MetricAnomaly.builder()
                .id(30L)
                .instanceEntity(instance)
                .metricName(MetricName.CPU)
                .status(AnomalyStatus.ACTIVE)
                .peakValue(99.0d)
                .lastSeenAt(LocalDateTime.now().minusMinutes(1))
                .startedAt(LocalDateTime.now().minusMinutes(10))
                .build();

        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                3L, MetricName.CPU, AnomalyStatus.ACTIVE)).thenReturn(Optional.of(active));
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                3L, MetricName.MEMORY, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                3L, MetricName.DISK, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.save(any(MetricAnomaly.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(snapshotService.saveEventSnapshot(any(), eq(MetricSnapshotType.RECOVERY), anyMap(), anyString(), any(), any()))
                .thenReturn(MetricsSnapshot.builder().Id(301L).build());

        MetricAnomalyService.DetectionResult result = metricAnomalyService.processMetrics(instance, metrics, previous, null);

        assertThat(result.lifecycleChanged()).isTrue();
        verify(snapshotService).saveEventSnapshot(any(), eq(MetricSnapshotType.RECOVERY), anyMap(), contains("recovered"), any(), isNull());

        ArgumentCaptor<MetricAnomaly> captor = ArgumentCaptor.forClass(MetricAnomaly.class);
        verify(anomalyRepository, atLeastOnce()).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AnomalyStatus.RESOLVED);
        assertThat(captor.getValue().getResolvedAt()).isNotNull();
        assertThat(captor.getValue().getRecoverySnapshotId()).isEqualTo(301L);
    }

    @Test
    void thresholdBreach_shouldCreateAnomalyEvenWhenSpikePercentBelowTwenty() {
        InstanceEntity instance = instance(4L, "i-4");
        LatestMetrics previous = LatestMetrics.builder().isValid(true).cpuUsage(88.0d).memoryUsage(45.0d).diskUsage(45.0d).build();
        Map<String, Object> metrics = metrics(91.0d, 45.0d, 45.0d);

        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                4L, MetricName.CPU, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                4L, MetricName.MEMORY, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                4L, MetricName.DISK, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.save(any(MetricAnomaly.class))).thenAnswer(invocation -> {
            MetricAnomaly anomaly = invocation.getArgument(0);
            if (anomaly.getId() == null) {
                anomaly.setId(40L);
            }
            return anomaly;
        });
        when(snapshotService.savePreSpikeSnapshot(any(), any(), anyString(), any(), any()))
                .thenReturn(MetricsSnapshot.builder().Id(401L).build());
        when(snapshotService.saveEventSnapshot(any(), eq(MetricSnapshotType.SPIKE_START), anyMap(), anyString(), any(), any()))
                .thenReturn(MetricsSnapshot.builder().Id(402L).build());

        metricAnomalyService.processMetrics(instance, metrics, previous, null);

        ArgumentCaptor<MetricAnomaly> captor = ArgumentCaptor.forClass(MetricAnomaly.class);
        verify(anomalyRepository, atLeastOnce()).save(captor.capture());
        MetricAnomaly created = captor.getAllValues().get(0);
        assertThat(created.getTriggerType()).isEqualTo(AnomalyTriggerType.THRESHOLD_BREACH);
        assertThat(created.getSpikePercentage()).isLessThan(20.0d);
    }

    @Test
    void tinyRelativeCpuMovement_shouldNotCreateAnomalySnapshot() {
        InstanceEntity instance = instance(5L, "i-5");
        LatestMetrics previous = LatestMetrics.builder()
                .isValid(true)
                .cpuUsage(0.5d)
                .memoryUsage(8.5d)
                .diskUsage(49.0d)
                .build();
        Map<String, Object> metrics = metrics(1.0d, 8.6d, 49.1d);

        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                5L, MetricName.CPU, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                5L, MetricName.MEMORY, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());
        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                5L, MetricName.DISK, AnomalyStatus.ACTIVE)).thenReturn(Optional.empty());

        MetricAnomalyService.DetectionResult result = metricAnomalyService.processMetrics(instance, metrics, previous, null);

        assertThat(result.lifecycleChanged()).isFalse();
        assertThat(result.updated()).isFalse();
        verify(anomalyRepository, never()).save(any(MetricAnomaly.class));
        verify(snapshotService, never()).savePreSpikeSnapshot(any(), any(), anyString(), any(), any());
        verify(lifecycleSnapshotService, never()).recordSpikePoint(any(), any(), anyMap(), anyString());
    }

    @Test
    void gradualCpuClimb_shouldCreateSustainedSpikeBeforeHardThreshold() {
        InstanceEntity instance = instance(6L, "i-6");

        when(anomalyRepository.findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
                eq(6L), any(MetricName.class), eq(AnomalyStatus.ACTIVE))).thenReturn(Optional.empty());
        when(anomalyRepository.save(any(MetricAnomaly.class))).thenAnswer(invocation -> {
            MetricAnomaly anomaly = invocation.getArgument(0);
            if (anomaly.getId() == null) {
                anomaly.setId(60L);
            }
            return anomaly;
        });
        when(snapshotService.savePreSpikeSnapshot(any(), any(), anyString(), any(), any()))
                .thenReturn(MetricsSnapshot.builder().Id(601L).build());
        when(snapshotService.saveEventSnapshot(any(), eq(MetricSnapshotType.SPIKE_START), anyMap(), anyString(), any(), any()))
                .thenReturn(MetricsSnapshot.builder().Id(602L).build());

        assertThat(metricAnomalyService.processMetrics(instance, metrics(15.0d, 30.0d, 40.0d), latest(10.0d), null).lifecycleChanged()).isFalse();
        assertThat(metricAnomalyService.processMetrics(instance, metrics(20.0d, 30.0d, 40.0d), latest(15.0d), null).lifecycleChanged()).isFalse();
        assertThat(metricAnomalyService.processMetrics(instance, metrics(25.0d, 30.0d, 40.0d), latest(20.0d), null).lifecycleChanged()).isFalse();

        MetricAnomalyService.DetectionResult result = metricAnomalyService.processMetrics(
                instance,
                metrics(30.0d, 30.0d, 40.0d),
                latest(25.0d),
                null
        );

        assertThat(result.lifecycleChanged()).isTrue();

        ArgumentCaptor<MetricAnomaly> captor = ArgumentCaptor.forClass(MetricAnomaly.class);
        verify(anomalyRepository, atLeastOnce()).save(captor.capture());
        MetricAnomaly created = captor.getAllValues().get(0);
        assertThat(created.getTriggerType()).isEqualTo(AnomalyTriggerType.SUSTAINED_SPIKE);
        assertThat(created.getBaselineValue()).isEqualTo(10.0d);
        assertThat(created.getCurrentValue()).isEqualTo(30.0d);
        assertThat(created.getSpikePercentage()).isEqualTo(200.0d);

        ArgumentCaptor<LatestMetrics> baselineCaptor = ArgumentCaptor.forClass(LatestMetrics.class);
        verify(snapshotService).savePreSpikeSnapshot(any(), baselineCaptor.capture(), anyString(), any(), any());
        assertThat(baselineCaptor.getValue().getCpuUsage()).isEqualTo(10.0d);
    }

    private InstanceEntity instance(Long id, String instanceId) {
        return InstanceEntity.builder()
                .id(id)
                .instanceId(instanceId)
                .state(MonitorState.UP)
                .build();
    }

    private Map<String, Object> metrics(Double cpu, Double memory, Double disk) {
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("isValid", true);
        metrics.put("cpu", cpu);
        metrics.put("memory", memory);
        metrics.put("disk", disk);
        metrics.put("networkIn", 100.0d);
        metrics.put("networkOut", 100.0d);
        return metrics;
    }

    private LatestMetrics latest(Double cpu) {
        return LatestMetrics.builder()
                .isValid(true)
                .cpuUsage(cpu)
                .memoryUsage(30.0d)
                .diskUsage(40.0d)
                .build();
    }
}
