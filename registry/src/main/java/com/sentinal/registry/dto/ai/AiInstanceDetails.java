package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Instance details for AI analysis.
 * Matches the Python FastAPI InstanceDetails model.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiInstanceDetails {
    private String instanceId;
    private String region;
    private String nickname;
    private String state;
    private Integer suspectCount;
    private Integer quarantineCount;
    private Integer maxSuspectStrikes;
    private Integer maxQuarantineCycles;
    private Integer quarantineDurationMinutes;
    private String lastError;
    private Long stateChangedAt;
}
