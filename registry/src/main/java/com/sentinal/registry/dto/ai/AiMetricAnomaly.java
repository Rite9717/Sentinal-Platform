package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMetricAnomaly {
    private Long id;
    private String metricName;
    private Double metricValue;
    private Double threshold;
    private String severity;
    private String instanceState;
    private String message;
    private String createdAt;
    private String resolvedAt;
}
