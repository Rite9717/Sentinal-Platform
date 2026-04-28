package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.LatestMetrics;
import com.sentinal.registry.repository.LatestMetricsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LatestMetricsService {

    private final LatestMetricsRepository latestMetricsRepository;

    public Optional<LatestMetrics> findByInstanceId(Long instanceId) {
        return latestMetricsRepository.findByInstanceEntity_Id(instanceId);
    }

    public LatestMetrics upsert(InstanceEntity instance, Map<String, Object> metrics) {
        LocalDateTime now = LocalDateTime.now();
        boolean isValid = Boolean.TRUE.equals(metrics.get("isValid"));

        LatestMetrics latest = latestMetricsRepository
                .findByInstanceEntity_Id(instance.getId())
                .orElseGet(() -> LatestMetrics.builder()
                        .instanceEntity(instance)
                        .build());

        latest.setCpuUsage(parseNullableDouble(metrics.get("cpu")));
        latest.setMemoryUsage(parseNullableDouble(metrics.get("memory")));
        latest.setDiskUsage(parseNullableDouble(metrics.get("disk")));
        latest.setDiskIops(parseNullableDouble(metrics.get("diskIops")));
        latest.setNetworkIn(parseNullableDouble(metrics.get("networkIn")));
        latest.setNetworkOut(parseNullableDouble(metrics.get("networkOut")));
        latest.setIsValid(isValid);
        latest.setErrorType(isValid ? null : valueAsString(metrics.get("errorType")));
        latest.setErrorMessage(isValid ? null : resolveErrorMessage(metrics));
        latest.setCollectedAt(now);
        latest.setUpdatedAt(now);
        return latestMetricsRepository.save(latest);
    }

    private String resolveErrorMessage(Map<String, Object> metrics) {
        String reason = valueAsString(metrics.get("reason"));
        if (reason != null && !reason.isBlank()) {
            return reason;
        }
        String error = valueAsString(metrics.get("error"));
        return (error != null && !error.isBlank()) ? error : "Metrics unavailable";
    }

    private Double parseNullableDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        String raw = value.toString().trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String valueAsString(Object value) {
        return value == null ? null : value.toString();
    }
}

