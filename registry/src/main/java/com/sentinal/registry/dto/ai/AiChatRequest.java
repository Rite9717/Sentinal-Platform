package com.sentinal.registry.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AiChatRequest {
    private String prompt;
    private List<Map<String, String>> chatHistory;
}
