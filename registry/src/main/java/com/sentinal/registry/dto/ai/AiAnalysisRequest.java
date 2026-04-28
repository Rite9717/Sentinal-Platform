package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Request payload for the Sentinel AI Analysis Service.
 * Matches the Python FastAPI AnalyzeRequest model.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAnalysisRequest {
    private AiInstanceDetails instance;
    private Long selectedSnapshotId;
    private AiMetricsSnapshot lastGoodSnapshot;
    private List<AiIncidentSnapshot> incidentSnapshots;
    private List<AiMetricsSnapshot> metricsSnapshots;
    private List<AiMetricAnomaly> metricAnomalies;
    private String analysisTask;
    private Map<String, Object> agentContext;
}
