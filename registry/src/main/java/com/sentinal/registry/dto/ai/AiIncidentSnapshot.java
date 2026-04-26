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
    private String incidentStartTime;
    private String incidentEndTime;
    private String resolution;
    private String metricsTimeline;
    private String aiContext;
    private String aiAnalysis;
}
