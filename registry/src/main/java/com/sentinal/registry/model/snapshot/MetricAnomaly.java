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

    private String metricName;
    private Double metricValue;
    private Double threshold;
    private String severity;

    @Enumerated(EnumType.STRING)
    private MonitorState instanceState;

    @Column(columnDefinition = "TEXT")
    private String message;

    private LocalDateTime createdAt;
    private LocalDateTime resolvedAt;
}
