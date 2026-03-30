package com.sentinal.registry.dto.instance;

import lombok.Data;

@Data
public class RegisterInstanceRequest {
    private String instanceId;   // i-039d676689fc848e8
    private String region;       // us-east-1
    private String nickname;     // "My Production Server"
    private String roleArn;      // arn:aws:iam::123456:role/SentinalMonitorRole
}