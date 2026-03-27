package com.project.Registry_Service.Config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ec2.Ec2Client;

@Slf4j
@Configuration
public class AwsConfig {
    @Bean
    @ConditionalOnProperty(name = "registry.recovery.ec2.enabled", havingValue = "true")
    public Ec2Client ec2Client() {
        log.info("Initializing AWS EC2 client with default credentials provider chain");
        
        return Ec2Client.builder()
                .credentialsProvider(DefaultCredentialsProvider.create())
                .region(Region.US_EAST_1) // Default region, can be overridden per instance
                .build();
    }
}
