package com.sentinal.registry.service.ai;

import com.sentinal.registry.dto.ai.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class SentinelAiClient {

    @Value("${sentinel.ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Value("${sentinel.ai.service.enabled:false}")
    private boolean aiServiceEnabled;

    @Value("${sentinel.ai.service.timeout:240000}")
    private int timeoutMs;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public SentinelAiClient(@Qualifier("aiRestTemplate") RestTemplate restTemplate, ObjectMapper objectMapper)
    {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    public CompletableFuture<AiAnalysisResponse> analyzeAsync(AiAnalysisRequest request) {
        if (!aiServiceEnabled) {
            log.warn("AI service is disabled. Skipping async analysis for instance: {}",
                    request.getInstance().getInstanceId());
            return CompletableFuture.completedFuture(
                    createDisabledResponse(request.getInstance().getInstanceId())
            );
        }

        return CompletableFuture.supplyAsync(() -> {
            try {
                return analyze(request);
            } catch (Exception e) {
                log.error("Async AI call failed for instance {}: {}",
                        request.getInstance().getInstanceId(), e.getMessage());
                return createErrorResponse(request.getInstance().getInstanceId(), e.getMessage());
            }
        });
    }

    public AiAnalysisResponse analyze(AiAnalysisRequest request) {
        String instanceId = request.getInstance() != null ? request.getInstance().getInstanceId() : null;

        if (!aiServiceEnabled) {
            log.warn("AI service is disabled. Skipping analysis for instance: {}", 
                    instanceId);
            return createDisabledResponse(instanceId);
        }

        if (!StringUtils.hasText(instanceId)) {
            return createErrorResponse("unknown", "Missing instanceId in analysis request");
        }

        try {
            String url = buildAiUrl("/agent/analyze-instance");
            int promptChars = request.getAnalysisTask() != null ? request.getAnalysisTask().length() : 0;
            log.info("Sending AI analysis request for instance {} to {}", 
                    instanceId, url);
            log.info("AI request context: instanceId={}, snapshotId={}, promptChars={}, allowedTools={}",
                    instanceId, request.getSelectedSnapshotId(), promptChars, request.getAllowedTools());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(List.of(MediaType.APPLICATION_JSON));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("instance_id", instanceId);
            payload.put("user_question", request.getAnalysisTask());
            payload.put("snapshot_id", request.getSelectedSnapshotId());
            payload.put("agent_context", request.getAgentContext());
            payload.put("allowed_tools", request.getAllowedTools());
            payload.put("chat_history", request.getChatHistory());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            ResponseEntity<Map> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    Map.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                log.info("AI analysis completed successfully for instance: {}", 
                        instanceId);
                return mapResponse(instanceId, response.getBody());
            } else {
                log.error("AI service returned non-success status: {}", response.getStatusCode());
                return createErrorResponse(instanceId, 
                        "AI service returned status: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Failed to get AI analysis for instance {}: {}", 
                    instanceId, e.getMessage(), e);
            return createErrorResponse(instanceId, e.getMessage());
        }
    }

    public boolean isServiceAvailable() {
        if (!aiServiceEnabled) {
            return false;
        }

        try {
            String url = buildAiUrl("/");
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("AI service health check failed: {}", e.getMessage());
            return false;
        }
    }

    private String buildAiUrl(String path) {
        if (aiServiceUrl.endsWith("/") && path.startsWith("/")) {
            return aiServiceUrl.substring(0, aiServiceUrl.length() - 1) + path;
        }
        if (!aiServiceUrl.endsWith("/") && !path.startsWith("/")) {
            return aiServiceUrl + "/" + path;
        }
        return aiServiceUrl + path;
    }

    private AiAnalysisResponse mapResponse(String instanceId, Map<?, ?> responseBody) {
        String rawResponse = asString(responseBody.get("raw_response"));
        Map<?, ?> normalizedBody = parseRawResponse(rawResponse);
        if (normalizedBody.isEmpty()) {
            normalizedBody = responseBody;
        }

        String severity = asString(normalizedBody.get("severity"));
        String rootCause = firstText(normalizedBody.get("root_cause"), normalizedBody.get("rootCause"));
        List<String> evidence = asStringList(normalizedBody.get("evidence"));
        List<String> actions = asStringList(firstObject(normalizedBody.get("recommended_actions"), normalizedBody.get("recommendedActions")));
        Boolean autoExecutable = asBoolean(firstObject(normalizedBody.get("auto_executable"), normalizedBody.get("autoExecutable")));
        List<String> toolsUsed = asStringList(firstObject(normalizedBody.get("tools_used"), normalizedBody.get("toolsUsed")));

        String resolvedRootCause = StringUtils.hasText(rootCause)
                ? rootCause
                : "No explicit root cause provided by the AI service.";
        String remediation = actions.isEmpty()
                ? "No remediation steps were provided."
                : String.join("\n", actions);
        String combined = buildCombinedNarrative(severity, resolvedRootCause, evidence, actions, autoExecutable);
        String triage = StringUtils.hasText(severity) ? "Severity: " + severity : "Analysis completed";

        return AiAnalysisResponse.builder()
                .instanceId(instanceId)
                .generatedAt(LocalDateTime.now().toString())
                .triage(triage)
                .rootCause(resolvedRootCause)
                .remediation(remediation)
                .combinedAnalysis(combined)
                .toolsUsed(toolsUsed)
                .build();
    }

    private Map<?, ?> parseRawResponse(String rawResponse) {
        String candidate = extractJsonCandidate(rawResponse);
        if (!StringUtils.hasText(candidate)) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(candidate, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Could not parse AI raw_response JSON: {}", e.getMessage());
            return Map.of();
        }
    }

    private String extractJsonCandidate(String rawResponse) {
        if (!StringUtils.hasText(rawResponse)) {
            return null;
        }
        String raw = rawResponse.trim();
        raw = raw.replaceFirst("(?is)^```(?:json)?\\s*", "")
                .replaceFirst("(?is)\\s*```$", "")
                .trim();
        if (raw.startsWith("{") && raw.endsWith("}")) {
            return raw;
        }
        int first = raw.indexOf('{');
        int last = raw.lastIndexOf('}');
        if (first < 0 || last <= first) {
            return null;
        }
        return raw.substring(first, last + 1).trim();
    }

    private String buildCombinedNarrative(
            String severity,
            String rootCause,
            List<String> evidence,
            List<String> actions,
            Boolean autoExecutable
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append("Severity: ").append(StringUtils.hasText(severity) ? severity : "UNKNOWN").append("\n");
        sb.append("Root Cause: ").append(rootCause).append("\n");

        if (!evidence.isEmpty()) {
            sb.append("Evidence:\n");
            for (String item : evidence) {
                sb.append("- ").append(item).append("\n");
            }
        } else {
            sb.append("Evidence: No supporting evidence returned.\n");
        }

        if (!actions.isEmpty()) {
            sb.append("Recommended Actions:\n");
            for (String item : actions) {
                sb.append("- ").append(item).append("\n");
            }
        } else {
            sb.append("Recommended Actions: No actions returned.\n");
        }

        if (autoExecutable != null) {
            sb.append("Auto Executable: ").append(autoExecutable);
        }

        return sb.toString().trim();
    }

    private String asString(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private String firstText(Object first, Object second) {
        String firstValue = asString(first);
        return StringUtils.hasText(firstValue) ? firstValue : asString(second);
    }

    private Object firstObject(Object first, Object second) {
        return first != null ? first : second;
    }

    private List<String> asStringList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (value instanceof Collection<?> collection) {
            List<String> values = new ArrayList<>();
            for (Object entry : collection) {
                values.add(String.valueOf(entry));
            }
            return values;
        }
        return List.of(String.valueOf(value));
    }

    private Boolean asBoolean(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Boolean bool) {
            return bool;
        }
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private AiAnalysisResponse createDisabledResponse(String instanceId) {
        return AiAnalysisResponse.builder()
                .instanceId(instanceId)
                .generatedAt(java.time.LocalDateTime.now().toString())
                .triage("AI analysis is disabled")
                .rootCause("AI analysis is disabled")
                .remediation("AI analysis is disabled")
                .combinedAnalysis("AI analysis service is currently disabled. Enable it in application configuration.")
                .toolsUsed(List.of())
                .build();
    }

    private AiAnalysisResponse createErrorResponse(String instanceId, String error) {
        return AiAnalysisResponse.builder()
                .instanceId(instanceId)
                .generatedAt(java.time.LocalDateTime.now().toString())
                .triage("AI analysis failed")
                .rootCause("Error communicating with AI service: " + error)
                .remediation("Check AI service availability and logs")
                .combinedAnalysis("AI analysis could not be completed due to an error: " + error)
                .toolsUsed(List.of())
                .build();
    }
}
