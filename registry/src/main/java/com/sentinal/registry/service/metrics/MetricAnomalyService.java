package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.MetricAnomaly;
import com.sentinal.registry.repository.MetricAnomalyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class MetricAnomalyService {

    private static final double CPU_THRESHOLD = 90.0;
    private static final double MEMORY_THRESHOLD = 85.0;
    private static final double DISK_THRESHOLD = 90.0;

    private final MetricAnomalyRepository anomalyRepository;

    public DetectionResult detectAndPersist(InstanceEntity instance, Map<String, Object> metrics) {
        DetectionResult cpu = evaluateMetric(instance, metrics, "cpu", CPU_THRESHOLD);
        DetectionResult memory = evaluateMetric(instance, metrics, "memory", MEMORY_THRESHOLD);
        DetectionResult disk = evaluateMetric(instance, metrics, "disk", DISK_THRESHOLD);
        return cpu.merge(memory).merge(disk);
    }

    private DetectionResult evaluateMetric(
            InstanceEntity instance,
            Map<String, Object> metrics,
            String metricName,
            double threshold
    ) {
        Double value = parseNullableDouble(metrics.get(metricName));
        DetectionResult[] result = {DetectionResult.none()};

        anomalyRepository
                .findByInstanceEntity_InstanceIdAndMetricNameAndResolvedAtIsNull(instance.getInstanceId(), metricName)
                .ifPresentOrElse(existing -> {
                    if (value != null && value > threshold) {
                        existing.setMetricValue(value);
                        existing.setThreshold(threshold);
                        existing.setSeverity(resolveSeverity(value, threshold));
                        existing.setInstanceState(instance.getState());
                        existing.setMessage(buildMessage(metricName, value, threshold, instance.getState().name()));
                        anomalyRepository.save(existing);
                        result[0] = DetectionResult.refreshed();
                    } else {
                        existing.setResolvedAt(LocalDateTime.now());
                        anomalyRepository.save(existing);
                        result[0] = DetectionResult.resolved();
                    }
                }, () -> {
                    if (value == null || value <= threshold) {
                        result[0] = DetectionResult.none();
                        return;
                    }
                    MetricAnomaly anomaly = MetricAnomaly.builder()
                            .instanceEntity(instance)
                            .metricName(metricName)
                            .metricValue(value)
                            .threshold(threshold)
                            .severity(resolveSeverity(value, threshold))
                            .instanceState(instance.getState())
                            .message(buildMessage(metricName, value, threshold, instance.getState().name()))
                            .createdAt(LocalDateTime.now())
                            .resolvedAt(null)
                            .build();
                    anomalyRepository.save(anomaly);
                    log.warn("Metric anomaly detected for instance {}: {}={}",
                            instance.getInstanceId(), metricName, value);
                    result[0] = DetectionResult.created();
                });
        return result[0];
    }

    private String resolveSeverity(double value, double threshold) {
        if (value >= threshold + 15) {
            return "CRITICAL";
        }
        if (value >= threshold + 8) {
            return "HIGH";
        }
        return "MEDIUM";
    }

    private String buildMessage(String metricName, double value, double threshold, String state) {
        return String.format(
                "%s is %.2f (threshold %.2f) while instance state is %s",
                metricName.toUpperCase(),
                value,
                threshold,
                state
        );
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

    public record DetectionResult(boolean createdOrResolved, boolean updated) {
        static DetectionResult none() {
            return new DetectionResult(false, false);
        }

        static DetectionResult created() {
            return new DetectionResult(true, false);
        }

        static DetectionResult resolved() {
            return new DetectionResult(true, false);
        }

        static DetectionResult refreshed() {
            return new DetectionResult(false, true);
        }

        DetectionResult merge(DetectionResult other) {
            if (other == null) {
                return this;
            }
            return new DetectionResult(this.createdOrResolved || other.createdOrResolved, this.updated || other.updated);
        }

        public boolean hasLifecycleChange() {
            return createdOrResolved;
        }
    }
}
