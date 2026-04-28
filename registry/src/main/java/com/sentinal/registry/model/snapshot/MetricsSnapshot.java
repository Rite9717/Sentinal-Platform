package com.sentinal.registry.model.snapshot;

import com.sentinal.registry.model.instances.InstanceEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Data
@Table(
        name  = "metrics_snapshot",
        indexes = {
                @Index(name = "idx_metrics_snapshot_instance_collected", columnList = "instance_id,collectedAt"),
                @Index(name = "idx_metrics_snapshot_valid_collected", columnList = "isValid,collectedAt"),
                @Index(name = "idx_metrics_snapshot_collected", columnList = "collectedAt")
        }
)
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MetricsSnapshot
{
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private  Long Id;

    @ManyToOne
    @JoinColumn(name = "instance_id")
    private InstanceEntity instanceEntity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "anomaly_id")
    private MetricAnomaly anomaly;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    private IncidentSnapshot incident;

    @Enumerated(EnumType.STRING)
    private MetricSnapshotType snapshotType;

    private String errorType;
    private String errorMessage;
    private LocalDateTime snapshotTime;
    private LocalDateTime errorTime;
    private LocalDateTime collectedAt;
    private Boolean isValid;

    private Double cpuUsage;
    private Double memoryUsage;
    private Double networkIn;
    private Double networkOut;
    private Double diskUsage;
    private Double diskIops;

    // Legacy numeric state code (kept for compatibility during migration).
    private Double instanceState;

    // Textual instance state captured with each meaningful metric evidence point.
    private String instanceStateLabel;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column( columnDefinition = "TEXT")
    private String timeSeriesJson;

    @Column( columnDefinition = "TEXT")
    private String aiContext;

    @Column( columnDefinition = "TEXT")
    private String aiAnalysis;

    private String grafanaSnapshotUrl;
    private String shareableUrl;
}
