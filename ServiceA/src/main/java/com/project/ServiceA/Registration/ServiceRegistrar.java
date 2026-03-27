package com.project.ServiceA.Registration;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Component
public class ServiceRegistrar implements CommandLineRunner
{
    private final RestTemplate restTemplate=new RestTemplate();
    private final String registryBase;
    private final String serviceHost;
    private final int servicePort;

    public ServiceRegistrar(
            @org.springframework.beans.factory.annotation.Value("${registry.base-url:http://localhost:8081/registry}") String registryBase,
            @org.springframework.beans.factory.annotation.Value("${service.host:sample-service-a}") String serviceHost,
            @org.springframework.beans.factory.annotation.Value("${server.port:9001}") int servicePort) {
        this.registryBase = registryBase;
        this.serviceHost = serviceHost;
        this.servicePort = servicePort;
    }

    @Override
    public void run(String... args) throws Exception
    {
        while (true) {
            try {
                register();
                break;   // success → exit loop
            } catch (Exception e) {
                System.out.println("Registry not ready yet, retrying in 5 seconds...");
                try {
                    Thread.sleep(5000);
                } catch (InterruptedException ignored) {}
            }
        }
    }

    private void register()
    {
        // Detect platform (Docker vs EC2)
        String platform = detectPlatform();

        // 1. Register service
        Map<String, Object> service = new HashMap<>();
        service.put("name", "sample-service-a");
        service.put("platform", platform);
        service.put("version", "1.0");

        restTemplate.postForObject(registryBase + "/service", service, Object.class);

        // 2. Register instance
        Map<String, Object> instance = new HashMap<>();
        instance.put("serviceName", "sample-service-a");
        instance.put("host", serviceHost);
        instance.put("port", servicePort);
        instance.put("baseUrl", "http://" + serviceHost + ":" + servicePort);
        instance.put("healthPath", "/actuator/health");

        // Add platform-specific details
        if ("docker".equals(platform)) {
            String containerName = System.getenv("HOSTNAME");
            if (containerName != null && !containerName.isEmpty()) {
                instance.put("containerName", containerName);
            }
        } else if ("ec2".equals(platform)) {
            String instanceId = getEC2InstanceId();
            String region = getEC2Region();
            if (instanceId != null) {
                instance.put("ec2InstanceId", instanceId);
            }
            if (region != null) {
                instance.put("ec2Region", region);
            }
        }

        restTemplate.postForObject(registryBase + "/instance", instance, Object.class);

        System.out.println("Service & Instance registered successfully with platform: " + platform);
    }

    private String detectPlatform() {
        // Check if running in Docker
        if (System.getenv("HOSTNAME") != null &&
            (new java.io.File("/.dockerenv").exists() ||
             System.getenv("container") != null)) {
            return "docker";
        }

        // Check if running on EC2
        try {
            RestTemplate metadataClient = new RestTemplate();
            metadataClient.getForObject("http://169.254.169.254/latest/meta-data/instance-id", String.class);
            return "ec2";
        } catch (Exception e) {
            // Not on EC2
        }

        return "docker"; // Default fallback
    }

    private String getEC2InstanceId() {
        try {
            RestTemplate metadataClient = new RestTemplate();
            return metadataClient.getForObject("http://169.254.169.254/latest/meta-data/instance-id", String.class);
        } catch (Exception e) {
            System.out.println("Could not retrieve EC2 instance ID: " + e.getMessage());
            return null;
        }
    }

    private String getEC2Region() {
        try {
            RestTemplate metadataClient = new RestTemplate();
            String az = metadataClient.getForObject("http://169.254.169.254/latest/meta-data/placement/availability-zone", String.class);
            if (az != null && az.length() > 0) {
                return az.substring(0, az.length() - 1); // Remove the AZ letter (e.g., us-east-1a -> us-east-1)
            }
        } catch (Exception e) {
            System.out.println("Could not retrieve EC2 region: " + e.getMessage());
        }
        return "us-east-1"; // Default fallback
    }
}
