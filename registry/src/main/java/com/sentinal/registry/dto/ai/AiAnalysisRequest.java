package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAnalysisRequest
{
    private AiInstanceDetails instance;
    private Long selectedSnapshotId;
    private AiMetricsSnapshot lastGoodSnapshot;
    private List<AiIncidentSnapshot> incidentSnapshots;
    private List<AiMetricsSnapshot> metricsSnapshots;
    private List<AiMetricAnomaly> metricAnomalies;
    private String analysisTask;
    private Map<String, Object> agentContext;
    private List<String> allowedTools;
    private List<Map<String, String>> chatHistory;
}
