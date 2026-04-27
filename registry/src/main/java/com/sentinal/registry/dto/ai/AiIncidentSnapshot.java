package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Incident snapshot for AI analysis.
 * Matches the Python FastAPI IncidentSnapshotRow model.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiIncidentSnapshot {
    private Long id;
    private String status;
    private String severity;
    private String startedAt;
    private String resolvedAt;
    private String stateTransition;
    private String triggerReason;
    private Long lastGoodSnapshotId;
    private String resolution;
    private String metricsTimeline;
    private String aiContext;
    private String aiAnalysis;
    private String aiSummary;
}
