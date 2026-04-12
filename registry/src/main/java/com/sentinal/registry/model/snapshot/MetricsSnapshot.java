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
@Table(name  = "metrics_snapshot")
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

    private String errorType;
    private String errorMessage;
    private LocalDateTime snapshotTime;
    private LocalDateTime errorTime;

    private Double cpuUsage;
    private Double memoryUsage;
    private Double networkIn;
    private Double networkOut;
    private Double diskIops;
    private Double instanceState;

    @Column( columnDefinition = "TEXT")
    private String timeSeriesJson;

    @Column( columnDefinition = "TEXT")
    private String aiContext;

    @Column( columnDefinition = "TEXT")
    private String aiAnalysis;

    private String grafanaSnapshotUrl;
    private String shareableUrl;
}
