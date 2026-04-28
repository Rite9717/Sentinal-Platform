package com.sentinal.registry.model.snapshot;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "incident_event",
        indexes = {
                @Index(name = "idx_incident_event_incident_created", columnList = "incident_id,createdAt"),
                @Index(name = "idx_incident_event_instance_created", columnList = "instance_id,createdAt")
        }
)
public class IncidentEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id", nullable = false)
    private IncidentSnapshot incident;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instance_id", nullable = false)
    private InstanceEntity instanceEntity;

    @Enumerated(EnumType.STRING)
    private IncidentEventType eventType;

    @Enumerated(EnumType.STRING)
    private MonitorState fromState;

    @Enumerated(EnumType.STRING)
    private MonitorState toState;

    private Long snapshotId;
    private Long anomalyId;

    @Column(columnDefinition = "TEXT")
    private String message;

    private LocalDateTime createdAt;
}

