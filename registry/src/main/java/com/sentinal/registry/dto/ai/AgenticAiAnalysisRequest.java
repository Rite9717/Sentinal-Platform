package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AgenticAiAnalysisRequest {
    private Long instanceId;
    private Long snapshotId;
    private String prompt;
}
