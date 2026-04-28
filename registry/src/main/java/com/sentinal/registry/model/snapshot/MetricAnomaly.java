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
@Table(name = "metric_anomaly")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricAnomaly {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "instance_id", nullable = false)
    private InstanceEntity instanceEntity;

    @Enumerated(EnumType.STRING)
    private MetricName metricName;

    @Enumerated(EnumType.STRING)
    private AnomalyStatus status;

    @Enumerated(EnumType.STRING)
    private AnomalyTriggerType triggerType;

    private Double baselineValue;
    private Double startValue;
    private Double currentValue;
    private Double peakValue;
    private Double threshold;
    private Double spikePercentage;
    private String severity;

    @Enumerated(EnumType.STRING)
    private MonitorState instanceState;

    @Column(columnDefinition = "TEXT")
    private String message;

    // Legacy field (kept for backward compatibility with existing API consumers).
    private Double metricValue;

    // Legacy field (kept for backward compatibility).
    private LocalDateTime createdAt;

    private LocalDateTime startedAt;
    private LocalDateTime lastSeenAt;
    private LocalDateTime resolvedAt;

    private Long preSpikeSnapshotId;
    private Long startSnapshotId;
    private Long peakSnapshotId;
    private Long recoverySnapshotId;
}
