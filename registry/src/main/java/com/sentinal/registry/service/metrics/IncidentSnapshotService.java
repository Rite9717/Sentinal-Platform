package com.sentinal.registry.service.metrics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.model.snapshot.MetricsInterval;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.service.mail.MailService;
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

    public void onIncidentStart(
            InstanceEntity instance,
            MonitorState status,
            String stateTransition,
            String triggerReason,
            Long lastGoodSnapshotId,
            Map<String, Object> metrics
    ) {
        String instanceId = instance.getInstanceId();
        LocalDateTime now = LocalDateTime.now();

        var openIncidents = snapshotRepository.findByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc(instanceId);
        if (!openIncidents.isEmpty()) {
            if (openIncidents.size() > 1) {
                log.warn("Found {} open incidents for {}. Using latest open incident and appending interval.", openIncidents.size(), instanceId);
            }
            log.warn("Incident already open for {}, appending interval instead", instanceId);
            appendInterval(instance, status, stateTransition, triggerReason, metrics);
            return;
        }

        MetricsInterval first = buildInterval(status, triggerReason, metrics);

        IncidentSnapshot incident = IncidentSnapshot.builder()
                .instanceEntity(instance)
                .status(status)
                .severity(resolveSeverity(status))
                .startedAt(now)
                .resolvedAt(null)
                .stateTransition(stateTransition)
                .triggerReason(triggerReason)
                .lastGoodSnapshotId(lastGoodSnapshotId)
                .resolution(null)
                .metricsTimeline(toJson(List.of(first)))
                .aiContext(null)
                .aiAnalysis(null)
                .aiSummary(null)
                .build();

        snapshotRepository.save(incident);
        log.info("[INCIDENT OPEN] instance={} status={} transition={} lastGoodSnapshotId={}",
                instanceId, status, stateTransition, lastGoodSnapshotId);
    }

    public void appendInterval(
            InstanceEntity instance,
            MonitorState state,
            String stateTransition,
            String note,
            Map<String, Object> metrics
    ) {
        snapshotRepository
                .findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc(instance.getInstanceId())
                .ifPresentOrElse(incident -> {
                    MetricsInterval interval = buildInterval(state, note, metrics);
                    List<MetricsInterval> timeline = parseTimeline(incident.getMetricsTimeline());
                    timeline.add(interval);

                    incident.setStatus(state);
                    incident.setSeverity(resolveSeverity(state));
                    incident.setStateTransition(stateTransition);
                    incident.setTriggerReason(note);
                    incident.setMetricsTimeline(toJson(timeline));
                    snapshotRepository.save(incident);
                    log.info("[INCIDENT INTERVAL] instance={} state={} transition={} note={}",
                            instance.getInstanceId(), state, stateTransition, note);
                }, () -> log.warn("No open incident for {} — cannot append interval", instance.getInstanceId()));
    }

    public void onIncidentClose(
            InstanceEntity instance,
            MonitorState finalState,
            String stateTransition,
            String note,
            Map<String, Object> metrics
    ) {
        snapshotRepository
                .findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc(instance.getInstanceId())
                .ifPresentOrElse(incident -> {
                    MetricsInterval last = buildInterval(finalState, note, metrics);
                    List<MetricsInterval> timeline = parseTimeline(incident.getMetricsTimeline());
                    timeline.add(last);

                    LocalDateTime now = LocalDateTime.now();
                    MonitorState incidentStatus = normalizeIncidentStatus(finalState);
                    if (incident.getStartedAt() == null) {
                        LocalDateTime inferredStart = timeline.stream()
                                .map(MetricsInterval::getCapturedAt)
                                .filter(java.util.Objects::nonNull)
                                .findFirst()
                                .orElse(now);
                        incident.setStartedAt(inferredStart);
                        log.warn("Incident {} had null startedAt. Backfilled to {}", incident.getId(), inferredStart);
                    }

                    incident.setStatus(incidentStatus);
                    incident.setSeverity(resolveSeverity(incidentStatus));
                    incident.setResolvedAt(now);
                    incident.setResolution(finalState);
                    incident.setStateTransition(stateTransition);
                    incident.setTriggerReason(note);
                    incident.setMetricsTimeline(toJson(timeline));
                    incident.setAiContext(buildAiContext(instance, incident, timeline, finalState));

                    snapshotRepository.save(incident);
                    log.info("[INCIDENT CLOSED] instance={} status={} resolution={} intervals={}",
                            instance.getInstanceId(), incidentStatus, finalState, timeline.size());

                    if (finalState == MonitorState.TERMINATED) {
                        mailService.sendTerminationAlert(instance, incident);
                    }
                }, () -> log.warn("No open incident for {} — cannot close", instance.getInstanceId()));
    }

    private MetricsInterval buildInterval(MonitorState state, String note, Map<String, Object> metrics) {
        return MetricsInterval.builder()
                .state(state)
                .capturedAt(LocalDateTime.now())
                .cpuUsage(parseNullableDouble(metrics.get("cpu")))
                .memoryUsage(parseNullableDouble(metrics.get("memory")))
                .diskUsage(parseNullableDouble(metrics.get("disk")))
                .networkIn(parseNullableDouble(metrics.get("networkIn")))
                .networkOut(parseNullableDouble(metrics.get("networkOut")))
                .systemLoad(parseNullableDouble(metrics.get("load")))
                .note(note)
                .build();
    }

    private MonitorState normalizeIncidentStatus(MonitorState finalState) {
        if (finalState == MonitorState.UP) {
            return MonitorState.RECOVERED;
        }
        return finalState;
    }

    private String resolveSeverity(MonitorState state) {
        if (state == null) {
            return "MEDIUM";
        }
        return switch (state) {
            case SUSPECT -> "MEDIUM";
            case QUARANTINED -> "HIGH";
            case TERMINATED -> "CRITICAL";
            case RECOVERED, UP -> "INFO";
        };
    }

    private String buildAiContext(
            InstanceEntity instance,
            IncidentSnapshot incident,
            List<MetricsInterval> timeline,
            MonitorState resolution
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== INCIDENT REPORT ===\n\n");
        sb.append(String.format("Instance ID         : %s%n", instance.getInstanceId()));
        sb.append(String.format("Region              : %s%n", instance.getRegion()));
        sb.append(String.format("Incident status     : %s%n", incident.getStatus()));
        sb.append(String.format("Incident severity   : %s%n", incident.getSeverity()));
        sb.append(String.format("State transition    : %s%n", incident.getStateTransition()));
        sb.append(String.format("Trigger reason      : %s%n", incident.getTriggerReason()));
        sb.append(String.format("Last good snapshot  : %s%n",
                incident.getLastGoodSnapshotId() != null ? incident.getLastGoodSnapshotId() : "none"));
        sb.append(String.format("Incident started    : %s%n", formatOrUnavailable(incident.getStartedAt())));
        sb.append(String.format("Incident ended      : %s%n", formatOrUnavailable(incident.getResolvedAt())));
        sb.append(String.format("Resolution          : %s%n", resolution.name()));
        sb.append(String.format("Timeline intervals  : %d%n", timeline.size()));
        sb.append("\n--- TRANSITION TIMELINE ---\n\n");

        for (int i = 0; i < timeline.size(); i++) {
            MetricsInterval t = timeline.get(i);
            sb.append(String.format("[%d] %s | state=%s%n",
                    i + 1,
                    t.getCapturedAt() != null ? t.getCapturedAt().format(FMT) : "unknown",
                    t.getState()));
            sb.append(String.format("    note=%s cpu=%s memory=%s disk=%s networkIn=%s networkOut=%s load=%s%n",
                    valueOrUnavailable(t.getNote()),
                    valueOrUnavailable(t.getCpuUsage()),
                    valueOrUnavailable(t.getMemoryUsage()),
                    valueOrUnavailable(t.getDiskUsage()),
                    valueOrUnavailable(t.getNetworkIn()),
                    valueOrUnavailable(t.getNetworkOut()),
                    valueOrUnavailable(t.getSystemLoad())));
        }

        sb.append("\n--- AI TASK ---\n");
        sb.append("Use last good snapshot and timeline transitions to explain what degraded first,\n");
        sb.append("why state changed, and what remediation should be applied.\n");
        return sb.toString();
    }

    @SuppressWarnings("unchecked")
    private List<MetricsInterval> parseTimeline(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return new ArrayList<>(objectMapper.readValue(
                    json,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, MetricsInterval.class)
            ));
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

    private Double parseNullableDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        String raw = value.toString().trim();
        if (raw.isEmpty()) {
            return null;
        }
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String valueOrUnavailable(Object value) {
        if (value == null) {
            return "unavailable";
        }
        String raw = value.toString();
        return raw.isBlank() ? "unavailable" : raw;
    }

    private String formatOrUnavailable(LocalDateTime value) {
        return value != null ? value.format(FMT) : "unavailable";
    }
}
