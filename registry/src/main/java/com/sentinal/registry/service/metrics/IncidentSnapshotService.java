package com.sentinal.registry.service.metrics;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.MetricsInterval;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.service.mail.MailService;
import com.sentinal.registry.service.metrics.PrometheusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class IncidentSnapshotService {

    private final IncidentSnapshotRepository snapshotRepository;
    private final ObjectMapper objectMapper;
    private final MailService mailService;

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public void onIncidentStart(InstanceEntity instance, String note, Map<String, Object> metrics) {
        String instanceId = instance.getInstanceId();

        // Guard: if an open incident already exists (shouldn't happen, but be safe)
        if (snapshotRepository
                .findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNull(instanceId)
                .isPresent()) {
            log.warn("Incident already open for {}, skipping open", instanceId);
            appendInterval(instance, MonitorState.SUSPECT, note, metrics);
            return;
        }

        MetricsInterval first = MetricsInterval.builder()
                .state(MonitorState.SUSPECT)
                .capturedAt(LocalDateTime.now())
                .cpuUsage(parseDouble(metrics.get("cpu")))
                .memoryUsage(parseDouble(metrics.get("memory")))
                .diskUsage(parseDouble(metrics.get("disk")))
                .networkIn(parseDouble(metrics.get("networkIn")))
                .networkOut(parseDouble(metrics.get("networkOut")))
                .systemLoad(parseDouble(metrics.get("load")))
                .note(note)
                .build();

        IncidentSnapshot incident = IncidentSnapshot.builder()
                .instanceEntity(instance)
                .incidentStartTime(LocalDateTime.now())
                .incidentEndTime(null)
                .resolution(null)
                .metricsTimeline(toJson(List.of(first)))
                .aiContext(null)
                .aiAnalysis(null)
                .build();

        snapshotRepository.save(incident);
        log.info("[INCIDENT OPEN] instance={} note={}", instanceId, note);
    }

    public void appendInterval(InstanceEntity instance, MonitorState state, String note, Map<String, Object> metrics) {
        snapshotRepository
                .findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNull(instance.getInstanceId())
                .ifPresentOrElse(
                        incident -> {
                            MetricsInterval interval = MetricsInterval.builder()
                                    .state(state)
                                    .capturedAt(LocalDateTime.now())
                                    .cpuUsage(parseDouble(metrics.get("cpu")))
                                    .memoryUsage(parseDouble(metrics.get("memory")))
                                    .diskUsage(parseDouble(metrics.get("disk")))
                                    .networkIn(parseDouble(metrics.get("networkIn")))
                                    .networkOut(parseDouble(metrics.get("networkOut")))
                                    .systemLoad(parseDouble(metrics.get("load")))
                                    .note(note)
                                    .build();
                            List<MetricsInterval> timeline = parseTimeline(incident.getMetricsTimeline());
                            timeline.add(interval);
                            incident.setMetricsTimeline(toJson(timeline));
                            snapshotRepository.save(incident);
                            log.info("[INCIDENT INTERVAL] instance={} state={} note={}",
                                    instance.getInstanceId(), state, note);
                        },
                        () -> log.warn("No open incident for {} — cannot append interval", instance.getInstanceId())
                );
    }

    public void onIncidentClose(InstanceEntity instance, MonitorState finalState, String note, Map<String, Object> metrics) {
        snapshotRepository
                .findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNull(instance.getInstanceId())
                .ifPresentOrElse(
                        incident -> {
                            // Append final reading
                            MetricsInterval last = MetricsInterval.builder()
                                    .state(finalState)
                                    .capturedAt(LocalDateTime.now())
                                    .cpuUsage(parseDouble(metrics.get("cpu")))
                                    .memoryUsage(parseDouble(metrics.get("memory")))
                                    .diskUsage(parseDouble(metrics.get("disk")))
                                    .networkIn(parseDouble(metrics.get("networkIn")))
                                    .networkOut(parseDouble(metrics.get("networkOut")))
                                    .systemLoad(parseDouble(metrics.get("load")))
                                    .note(note)
                                    .build();
                            List<MetricsInterval> timeline = parseTimeline(incident.getMetricsTimeline());
                            timeline.add(last);

                            incident.setMetricsTimeline(toJson(timeline));
                            incident.setIncidentEndTime(LocalDateTime.now());
                            incident.setResolution(finalState);
                            incident.setAiContext(buildAiContext(instance, incident, timeline, finalState));

                            snapshotRepository.save(incident);
                            log.info("[INCIDENT CLOSED] instance={} resolution={} intervals={}",
                                    instance.getInstanceId(), finalState, timeline.size());
                            if(finalState == MonitorState.TERMINATED)
                            {
                                mailService.sendTerminationAlert(instance,incident);
                            }
                        },
                        () -> log.warn("No open incident for {} — cannot close", instance.getInstanceId())
                );
    }

    private String buildAiContext(InstanceEntity instance,
                                  IncidentSnapshot incident,
                                  List<MetricsInterval> timeline,
                                  MonitorState resolution) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== INCIDENT REPORT ===\n\n");
        sb.append(String.format("Instance ID      : %s%n", instance.getInstanceId()));
        sb.append(String.format("Region           : %s%n", instance.getRegion()));
        sb.append(String.format("Incident started : %s%n", incident.getIncidentStartTime().format(FMT)));
        sb.append(String.format("Incident ended   : %s%n", incident.getIncidentEndTime().format(FMT)));
        sb.append(String.format("Resolution       : %s%n", resolution.name()));
        sb.append(String.format("Total intervals  : %d%n", timeline.size()));
        sb.append(String.format("Max suspect strikes allowed : %d%n", instance.getMaxSuspectStrikes()));
        sb.append(String.format("Max quarantine cycles allowed: %d%n", instance.getMaxQuarantineCycles()));
        sb.append("\n--- METRICS TIMELINE ---\n\n");

        for (int i = 0; i < timeline.size(); i++) {
            MetricsInterval t = timeline.get(i);
            sb.append(String.format("Interval %d — %s @ %s%n",
                    i + 1, t.getState(), t.getCapturedAt() != null ? t.getCapturedAt().format(FMT) : "unknown"));
            sb.append(String.format("  Note       : %s%n", t.getNote() != null ? t.getNote() : "—"));
            sb.append(String.format("  CPU        : %.2f%%%n",   nvl(t.getCpuUsage())));
            sb.append(String.format("  Memory     : %.2f%%%n",   nvl(t.getMemoryUsage())));
            sb.append(String.format("  Disk       : %.2f%%%n",   nvl(t.getDiskUsage())));
            sb.append(String.format("  Network in : %.2f B/s%n", nvl(t.getNetworkIn())));
            sb.append(String.format("  Network out: %.2f B/s%n", nvl(t.getNetworkOut())));
            sb.append(String.format("  Load avg   : %.2f%n",     nvl(t.getSystemLoad())));
            sb.append("\n");
        }

        sb.append("--- AI TASK ---\n");
        sb.append("Using the timeline above, please:\n");
        sb.append("1. Identify which metric first degraded and when.\n");
        sb.append("2. Determine the likely root cause of this incident.\n");
        sb.append("3. Explain how the metrics evolved across each state transition.\n");
        sb.append("4. Suggest specific remediation steps to prevent recurrence.\n");

        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private List<MetricsInterval> parseTimeline(String json) {
        try {
            return new ArrayList<>(objectMapper.readValue(json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, MetricsInterval.class)));
        } catch (Exception e) {
            log.error("Failed to parse timeline JSON: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private String toJson(List<MetricsInterval> timeline) {
        try {
            return objectMapper.writeValueAsString(timeline);
        } catch (Exception e) {
            log.error("Failed to serialise timeline: {}", e.getMessage());
            return "[]";
        }
    }

    private double parseDouble(Object value) {
        try {
            return value != null ? Double.parseDouble(value.toString()) : 0.0;
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    private double nvl(Double v) {
        return v != null ? v : 0.0;
    }
}
