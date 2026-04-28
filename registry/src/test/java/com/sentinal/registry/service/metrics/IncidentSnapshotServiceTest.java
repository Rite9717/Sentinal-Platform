package com.sentinal.registry.service.metrics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.IncidentEvent;
import com.sentinal.registry.model.snapshot.IncidentEventType;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import com.sentinal.registry.repository.IncidentEventRepository;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.service.mail.MailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IncidentSnapshotServiceTest {

    @Mock
    private IncidentSnapshotRepository snapshotRepository;

    @Mock
    private IncidentEventRepository incidentEventRepository;

    @Mock
    private MailService mailService;

    private IncidentSnapshotService incidentSnapshotService;

    @BeforeEach
    void setUp() {
        incidentSnapshotService = new IncidentSnapshotService(
                snapshotRepository,
                incidentEventRepository,
                new ObjectMapper().findAndRegisterModules(),
                mailService
        );
    }

    @Test
    void onIncidentStart_shouldCreateStructuredIncidentEvent() {
        InstanceEntity instance = InstanceEntity.builder().id(1L).instanceId("i-evt-1").region("us-east-1").build();
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("cpu", 91.0d);
        metrics.put("memory", 88.0d);
        metrics.put("disk", 40.0d);

        when(snapshotRepository.findByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc("i-evt-1"))
                .thenReturn(List.of());
        when(snapshotRepository.save(any(IncidentSnapshot.class))).thenAnswer(invocation -> {
            IncidentSnapshot incident = invocation.getArgument(0);
            incident.setId(100L);
            return incident;
        });

        incidentSnapshotService.onIncidentStart(
                instance,
                MonitorState.SUSPECT,
                "UP -> SUSPECT",
                "Health degraded",
                88L,
                metrics
        );

        ArgumentCaptor<IncidentEvent> eventCaptor = ArgumentCaptor.forClass(IncidentEvent.class);
        verify(incidentEventRepository).save(eventCaptor.capture());
        IncidentEvent event = eventCaptor.getValue();
        assertThat(event.getEventType()).isEqualTo(IncidentEventType.SUSPECT_STARTED);
        assertThat(event.getIncident()).isNotNull();
        assertThat(event.getIncident().getId()).isEqualTo(100L);
    }

    @Test
    void onIncidentClose_shouldBackfillNullStartedAtAndRecordRecoveredEvent() {
        InstanceEntity instance = InstanceEntity.builder().id(2L).instanceId("i-evt-2").region("us-east-1").build();
        IncidentSnapshot openIncident = IncidentSnapshot.builder()
                .id(200L)
                .instanceEntity(instance)
                .status(MonitorState.QUARANTINED)
                .startedAt(null)
                .metricsTimeline("[]")
                .build();

        when(snapshotRepository.findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc("i-evt-2"))
                .thenReturn(Optional.of(openIncident));
        when(snapshotRepository.save(any(IncidentSnapshot.class))).thenAnswer(invocation -> invocation.getArgument(0));

        incidentSnapshotService.onIncidentClose(
                instance,
                MonitorState.UP,
                "QUARANTINED -> UP",
                "Recovered during quarantine",
                Map.of("cpu", 48.0d, "memory", 32.0d, "disk", 52.0d)
        );

        ArgumentCaptor<IncidentSnapshot> incidentCaptor = ArgumentCaptor.forClass(IncidentSnapshot.class);
        verify(snapshotRepository, atLeastOnce()).save(incidentCaptor.capture());
        IncidentSnapshot closed = incidentCaptor.getValue();
        assertThat(closed.getStartedAt()).isNotNull();
        assertThat(closed.getResolvedAt()).isNotNull();
        assertThat(closed.getFinalState()).isEqualTo(MonitorState.UP);

        ArgumentCaptor<IncidentEvent> eventCaptor = ArgumentCaptor.forClass(IncidentEvent.class);
        verify(incidentEventRepository, atLeastOnce()).save(eventCaptor.capture());
        assertThat(eventCaptor.getAllValues())
                .anyMatch(event -> event.getEventType() == IncidentEventType.RECOVERED && event.getCreatedAt() != null);
    }
}
