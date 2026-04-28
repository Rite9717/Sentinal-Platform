package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.LatestMetrics;
import com.sentinal.registry.repository.LatestMetricsRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LatestMetricsServiceTest {

    @Mock
    private LatestMetricsRepository latestMetricsRepository;

    @InjectMocks
    private LatestMetricsService latestMetricsService;

    @Test
    void upsert_shouldStoreValidMetricsWithoutErrors() {
        InstanceEntity instance = InstanceEntity.builder().id(1L).instanceId("i-123").build();
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("isValid", true);
        metrics.put("cpu", 47.2d);
        metrics.put("memory", 63.1d);
        metrics.put("disk", 71.0d);
        metrics.put("diskIops", 120.5d);
        metrics.put("networkIn", 1024.0d);
        metrics.put("networkOut", 2048.0d);

        when(latestMetricsRepository.findByInstanceEntity_Id(1L)).thenReturn(Optional.empty());
        when(latestMetricsRepository.save(any(LatestMetrics.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LatestMetrics saved = latestMetricsService.upsert(instance, metrics);

        assertThat(saved.getIsValid()).isTrue();
        assertThat(saved.getCpuUsage()).isEqualTo(47.2d);
        assertThat(saved.getMemoryUsage()).isEqualTo(63.1d);
        assertThat(saved.getDiskUsage()).isEqualTo(71.0d);
        assertThat(saved.getErrorType()).isNull();
        assertThat(saved.getErrorMessage()).isNull();
        assertThat(saved.getCollectedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void upsert_shouldMarkInvalidWithoutFakeZeroMetrics() {
        InstanceEntity instance = InstanceEntity.builder().id(2L).instanceId("i-456").build();
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("isValid", false);
        metrics.put("cpu", null);
        metrics.put("memory", null);
        metrics.put("disk", null);
        metrics.put("diskIops", null);
        metrics.put("networkIn", null);
        metrics.put("networkOut", null);
        metrics.put("reason", "Prometheus timeout");
        metrics.put("errorType", "METRICS_UNAVAILABLE");

        when(latestMetricsRepository.findByInstanceEntity_Id(2L)).thenReturn(Optional.empty());
        when(latestMetricsRepository.save(any(LatestMetrics.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LatestMetrics saved = latestMetricsService.upsert(instance, metrics);

        assertThat(saved.getIsValid()).isFalse();
        assertThat(saved.getCpuUsage()).isNull();
        assertThat(saved.getMemoryUsage()).isNull();
        assertThat(saved.getDiskUsage()).isNull();
        assertThat(saved.getNetworkIn()).isNull();
        assertThat(saved.getNetworkOut()).isNull();
        assertThat(saved.getErrorType()).isEqualTo("METRICS_UNAVAILABLE");
        assertThat(saved.getErrorMessage()).isEqualTo("Prometheus timeout");
    }
}
