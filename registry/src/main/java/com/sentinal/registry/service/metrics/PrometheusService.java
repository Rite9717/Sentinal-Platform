package com.sentinal.registry.service.metrics;


import com.sentinal.registry.model.instances.MonitorState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class PrometheusService
{
    @Value("${prometheus.url}")
    private String prometheusUrl;

    private final RestTemplate restTemplate =  new RestTemplateBuilder()
            .connectTimeout(Duration.ofSeconds(2))
            .readTimeout(Duration.ofSeconds(5))
            .build();

    private Map<String,Object> query(String promQL)
    {
        try {
            log.info("Executing PromQL: {}", promQL);
            var url = UriComponentsBuilder
                    .fromHttpUrl(prometheusUrl + "/api/v1/query")
                    .queryParam("query", promQL)
                    .build()
                    .encode()
                    .toUri();
            return restTemplate.getForObject(url, Map.class);
        } catch (Exception e) {
            log.error("Prometheus query failed: {}", e.getMessage());
            return Map.of("status", "error", "error", e.getMessage());
        }
    }

    // CPU usage — FIXED
    public Map<String, Object> getCpuUsage(String instanceId) {
        String promQL = String.format(
                "100 * (1 - avg(rate(node_cpu_seconds_total{mode=\"idle\",instance_id=\"%s\"}[5m])))",
                instanceId
        );
        return query(promQL);
    }

    // Memory usage — FIXED
    public Map<String, Object> getMemoryUsage(String instanceId) {
        String promQL = String.format(
                "100 * (1 - (node_memory_MemAvailable_bytes{instance_id=\"%s\"} / node_memory_MemTotal_bytes{instance_id=\"%s\"}))",
                instanceId,instanceId
        );
        return query(promQL);
    }

    public Map<String, Object> getDiskUsage(String instanceId)
    {
        String promQl = String.format(
                "100 * (1 - (node_filesystem_avail_bytes{instance_id=\"%s\",mountpoint=\"/\",fstype!=\"tmpfs\"} / node_filesystem_size_bytes{instance_id=\"%s\",mountpoint=\"/\",fstype!=\"tmpfs\"}))",
                instanceId,instanceId
        );
        return  query(promQl);
    }
    // Network in
    public Map<String, Object> getNetworkIn(String instanceId) {
        String promQL = String.format("sum(rate(node_network_receive_bytes_total{instance_id=\"%s\"}[5m]))",instanceId);
        return query(promQL);
    }

    // Network out
    public Map<String, Object> getNetworkOut(String instanceId) {
        String promQL = String.format("sum(rate(node_network_transmit_bytes_total{instance_id=\"%s\"}[5m]))",instanceId);
        return query(promQL);
    }

    // System load
    public Map<String, Object> getSystemLoad(String instanceId) {
        String promQL = String.format("node_load1{instance_id=\"%s\"}",instanceId);
        return query(promQL);
    }

    public Map<String, Object> getAllMetrics(String instanceId, MonitorState state) {
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("instanceId", instanceId);
        metrics.put("state", state != null ? state.name() : "UNKNOWN");

        Double cpu = extractValue(getCpuUsage(instanceId));
        Double memory = extractValue(getMemoryUsage(instanceId));
        Double disk = extractValue(getDiskUsage(instanceId));
        Double networkIn = extractValue(getNetworkIn(instanceId));
        Double networkOut = extractValue(getNetworkOut(instanceId));
        Double load = extractValue(getSystemLoad(instanceId));

        metrics.put("cpu", cpu);
        metrics.put("memory", memory);
        metrics.put("disk", disk);
        metrics.put("networkIn", networkIn);
        metrics.put("networkOut", networkOut);
        metrics.put("load", load);

        boolean isValid = cpu != null || memory != null || disk != null || networkIn != null || networkOut != null || load != null;
        metrics.put("isValid", isValid);
        metrics.put("status", isValid ? "ok" : "unavailable");
        if (!isValid) {
            metrics.put("reason", "Prometheus returned no metric samples for this check");
        }
        return metrics;
    }

    // Extract the actual value from Prometheus response
    private Double extractValue(Map<String, Object> response) {
        try {
            if (response == null || !"success".equals(response.get("status"))) {
                return null;
            }
            Map<String, Object> data = (Map<String, Object>) response.get("data");
            if (data == null) {
                return null;
            }
            List<Map<String, Object>> result = (List<Map<String, Object>>) data.get("result");
            if (result == null || result.isEmpty()) {
                return null;
            }
            double sum = 0.0;
            boolean hasValue = false;
            for (Map<String, Object> entry : result) {
                List<Object> value = (List<Object>) entry.get("value");
                if (value == null || value.size() < 2 || value.get(1) == null) {
                    continue;
                }
                String raw = value.get(1).toString().trim();
                if (raw.isEmpty() || "NaN".equalsIgnoreCase(raw)) {
                    continue;
                }
                sum += Double.parseDouble(raw);
                hasValue = true;
            }
            return hasValue ? sum : null;
        } catch (Exception e) {
            log.warn("Could not extract value from Prometheus response: {}", e.getMessage());
        }
        return null;
    }
}
