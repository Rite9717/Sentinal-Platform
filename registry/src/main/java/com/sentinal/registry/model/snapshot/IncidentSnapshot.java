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
@Table(name = "incident_snapshot")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IncidentSnapshot
{
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name  = "instance_id")
    private InstanceEntity instanceEntity;

    @Enumerated(EnumType.STRING)
    private MonitorState status;

    private String severity;
    private LocalDateTime startedAt;
    private LocalDateTime resolvedAt;
    private String stateTransition;

    @Column(columnDefinition = "TEXT")
    private String triggerReason;

    private Long lastGoodSnapshotId;

    @Enumerated(EnumType.STRING)
    private MonitorState resolution;

    @Column(columnDefinition = "TEXT")
    private String metricsTimeline;

    @Column(columnDefinition = "TEXT")
    private String aiContext;

    @Column(columnDefinition = "TEXT")
    private String aiAnalysis;

    @Column(columnDefinition = "TEXT")
    private String aiSummary;
}
