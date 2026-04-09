package com.sentinal.registry.service.metrics;


import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class PrometheusService
{
    @Value("${prometheus.url}")
    private String prometheusUrl;

    private final RestTemplate restTemplate =  new RestTemplate();
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

    // Get all metrics at once
    public Map<String, Object> getAllMetrics(String instanceId) {
        Map<String, Object> metrics = new HashMap<>();

        try {
            double cpuUsage = Double.parseDouble(extractValue(getCpuUsage(instanceId)));
            double memory = Double.parseDouble(extractValue(getMemoryUsage(instanceId)));
            double disk  = Double.parseDouble(extractValue(getDiskUsage(instanceId)));

            metrics.put("cpu", String.format("%.2f", cpuUsage));
            metrics.put("memory", String.format("%.2f", memory));
            metrics.put("disk", String.format("%.2f", disk));
            metrics.put("networkIn", extractValue(getNetworkIn(instanceId)));
            metrics.put("networkOut", extractValue(getNetworkOut(instanceId)));
            metrics.put("load", extractValue(getSystemLoad(instanceId)));
            metrics.put("instanceId", instanceId);
            metrics.put("status", "ok");
        } catch (Exception e) {
            metrics.put("status", "error");
            metrics.put("error", e.getMessage());
        }

        return metrics;
    }

    // Extract the actual value from Prometheus response
    private String extractValue(Map<String, Object> response) {
        try {
            Map<String, Object> data = (Map<String, Object>) response.get("data");
            List<Map<String, Object>> result = (List<Map<String, Object>>) data.get("result");
            if (result != null && result.isEmpty())
            {
                return "0";
            }
            double sum = 0;
            for (Map<String, Object> entry : result)
            {
                List<Object> value = (List<Object>) entry.get("value");
                sum+= Double.parseDouble(value.get(1).toString());
            }
            return String.valueOf(sum);
        } catch (Exception e) {
            log.warn("Could not extract value from Prometheus response: {}", e.getMessage());
        }
        return "0";
    }
}
