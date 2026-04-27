package com.sentinal.registry.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * Configuration for RestTemplate used for external service calls.
 */
@Configuration
public class RestTemplateConfig {

    @Value("${sentinel.ai.service.timeout:240000}")
    private int aiServiceTimeout;

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(10))
                .setReadTimeout(Duration.ofMillis(aiServiceTimeout))
                .build();
    }
}
