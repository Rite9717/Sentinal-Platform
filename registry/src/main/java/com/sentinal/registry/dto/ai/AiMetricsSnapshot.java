package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Metrics snapshot for AI analysis.
 * Matches the Python FastAPI MetricsSnapshotRow model.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiMetricsSnapshot {
    private Long id;
    private String errorType;
    private String errorMessage;
    private String snapshotTime;
    private Double cpuUsage;
    private Double memoryUsage;
    private Double networkIn;
    private Double networkOut;
    private Double diskIops;
    private Double instanceState;
    private String aiContext;
}
