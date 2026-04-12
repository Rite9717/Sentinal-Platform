package com.sentinal.registry.service.metrics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class MetricsSnapshotService
{
    private final MetricSnapshotRepository snapshotRepository;
    private final PrometheusService prometheusService;
    private final ObjectMapper objectMapper;

    public void captureSnapshot(InstanceEntity instance, String errorType, String errorMessage)
    {
        try {
            log.info("Capturing metrics snapshot for instance {} - reason: {}",instance.getInstanceId(), errorType);
            Map<String, Object> metrics = prometheusService.getAllMetrics(instance.getInstanceId(), instance.getState());
            Map<String, Object> timeSeriesData;
            if("unavailable".equals(metrics.get("status")))
            {
                log.warn("Skipping Prometheus series queries for instance {} — state is {}",
                        instance.getInstanceId(), instance.getState());
                timeSeriesData = Map.of();
            }
            else {
                Map<String, Object> cpuSeries = prometheusService.getCpuUsage(instance.getInstanceId());
                Map<String, Object> memSeries = prometheusService.getMemoryUsage(instance.getInstanceId());
                Map<String, Object> diskSeries = prometheusService.getDiskUsage(instance.getInstanceId());
                Map<String, Object> netInSeries = prometheusService.getNetworkIn(instance.getInstanceId());
                Map<String, Object> netOutSeries = prometheusService.getNetworkOut(instance.getInstanceId());
                Map<String, Object> loadSeries = prometheusService.getSystemLoad(instance.getInstanceId());

                timeSeriesData = Map.of(
                        "cpu", cpuSeries,
                        "memory", memSeries,
                        "disk", diskSeries,
                        "netIn", netInSeries,
                        "netOut", netOutSeries,
                        "load", loadSeries
                );
            }

            String aiContext = buildAiContext(instance, errorType, errorMessage, metrics);

            double cpu = parseDouble(metrics.get("cpu"));
            double memory = parseDouble(metrics.get("memory"));
            double netIn = parseDouble(metrics.get("networkIn"));
            double netOut = parseDouble(metrics.get("networkOut"));
            double disk = parseDouble(metrics.get("disk"));

            MetricsSnapshot snapshot = MetricsSnapshot.builder()
                    .instanceEntity(instance)
                    .errorType(errorType)
                    .errorMessage(errorMessage)
                    .snapshotTime(LocalDateTime.now())
                    .errorTime(LocalDateTime.now())
                    .cpuUsage(cpu)
                    .memoryUsage(memory)
                    .networkIn(netIn)
                    .networkOut(netOut)
                    .diskIops(disk)
                    .instanceState((double) mapStateToCode(instance.getState().name()))
                    .timeSeriesJson(objectMapper.writeValueAsString(timeSeriesData))
                    .aiContext(aiContext)
                    .aiAnalysis(null)  // filled later when AI responds
                    .grafanaSnapshotUrl(null) // fill if you integrate Grafana
                    .shareableUrl(null)
                    .build();

            snapshotRepository.save(snapshot);
            log.info("Snapshot saved for instance {} (type={})", instance.getInstanceId(), errorType);
        } catch (Exception e) {
            log.error("Failed to save snapshot for instance {}: {}",
                    instance.getInstanceId(), e.getMessage());
        }
    }

    private String buildAiContext(InstanceEntity instance, String errorType, String errorMessage, Map<String, Object> metrics)
    {
        return String.format("""
                Instance ID   : %s
                            Region        : %s
                            Error type    : %s
                            Error message : %s
                            State at fault: %s
                            Suspect strikes: %d / %d
                            Quarantine cycles: %d / %d
                
                            Metrics at time of incident:
                              CPU usage   : %s%%
                              Memory usage: %s%%
                              Disk usage  : %s%%
                              Network in  : %s bytes/s
                              Network out : %s bytes/s
                              System load : %s
                
                            Please diagnose the likely root cause and suggest remediation steps.
                """,
                instance.getInstanceId(),
                instance.getRegion(),
                errorType,
                errorMessage != null ? errorMessage : "none",
                instance.getState(),
                instance.getSuspectCount(),
                instance.getMaxSuspectStrikes(),
                instance.getQuarantineCount(),
                instance.getMaxQuarantineCycles(),
                metrics.getOrDefault("cpu", "N/A"),
                metrics.getOrDefault("memory", "N/A"),
                metrics.getOrDefault("disk", "N/A"),
                metrics.getOrDefault("networkIn", "N/A"),
                metrics.getOrDefault("networkOut", "N/A"),
                metrics.getOrDefault("load", "N/A")
                );
    }

    private double parseDouble(Object value)
    {
        try {
            return value != null ? Double.parseDouble(value.toString()) : 0.0;
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    private int mapStateToCode(String state)
    {
        return switch (state) {
            case "UP"           -> 1;
            case "SUSPECT"      -> 2;
            case "QUARANTINED"  -> 3;
            case "TERMINATED"   -> 4;
            default             -> 0;
        };
    }
}
