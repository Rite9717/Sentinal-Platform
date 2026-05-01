package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response from the Sentinel AI Analysis Service.
 * Matches the Python FastAPI AnalyzeResponse model.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiAnalysisResponse {
    private String instanceId;
    private String generatedAt;
    private String triage;
    private String rootCause;
    private String remediation;
    private String combinedAnalysis;
    private List<String> toolsUsed;
}
