package com.sentinal.registry.service.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.dto.ai.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.concurrent.CompletableFuture;

@Service
@Slf4j
public class SentinelAiClient {

    @Value("${sentinel.ai.service.url:http://localhost:8000}")
    private String aiServiceUrl;

    @Value("${sentinel.ai.service.enabled:false}")
    private boolean aiServiceEnabled;

    @Value("${sentinel.ai.service.timeout:30000}")
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
                String requestBody = objectMapper.writeValueAsString(request);
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                ResponseEntity<String> response = restTemplate.exchange(
                        aiServiceUrl + "/analyze",
                        HttpMethod.POST,
                        new HttpEntity<>(requestBody, headers),
                        String.class
                );

                return objectMapper.readValue(response.getBody(), AiAnalysisResponse.class);

            } catch (Exception e) {
                log.error("Async AI call failed for instance {}: {}",
                        request.getInstance().getInstanceId(), e.getMessage());
                return createErrorResponse(request.getInstance().getInstanceId(), e.getMessage());
            }
        });
    }

    public AiAnalysisResponse analyze(AiAnalysisRequest request) {
        if (!aiServiceEnabled) {
            log.warn("AI service is disabled. Skipping analysis for instance: {}", 
                    request.getInstance().getInstanceId());
            return createDisabledResponse(request.getInstance().getInstanceId());
        }

        try {
            String url = aiServiceUrl + "/analyze";
            log.info("Sending AI analysis request for instance {} to {}", 
                    request.getInstance().getInstanceId(), url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<AiAnalysisRequest> entity = new HttpEntity<>(request, headers);

            ResponseEntity<AiAnalysisResponse> response = restTemplate.exchange(
                    url,
                    HttpMethod.POST,
                    entity,
                    AiAnalysisResponse.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                log.info("AI analysis completed successfully for instance: {}", 
                        request.getInstance().getInstanceId());
                return response.getBody();
            } else {
                log.error("AI service returned non-success status: {}", response.getStatusCode());
                return createErrorResponse(request.getInstance().getInstanceId(), 
                        "AI service returned status: " + response.getStatusCode());
            }

        } catch (Exception e) {
            log.error("Failed to get AI analysis for instance {}: {}", 
                    request.getInstance().getInstanceId(), e.getMessage(), e);
            return createErrorResponse(request.getInstance().getInstanceId(), e.getMessage());
        }
    }

    public boolean isServiceAvailable() {
        if (!aiServiceEnabled) {
            return false;
        }

        try {
            String url = aiServiceUrl + "/health";
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            log.warn("AI service health check failed: {}", e.getMessage());
            return false;
        }
    }

    private AiAnalysisResponse createDisabledResponse(String instanceId) {
        return AiAnalysisResponse.builder()
                .instanceId(instanceId)
                .generatedAt(java.time.LocalDateTime.now().toString())
                .triage("AI analysis is disabled")
                .rootCause("AI analysis is disabled")
                .remediation("AI analysis is disabled")
                .combinedAnalysis("AI analysis service is currently disabled. Enable it in application configuration.")
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
                .build();
    }
}
