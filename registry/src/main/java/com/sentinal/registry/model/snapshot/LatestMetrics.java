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
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "latest_metrics",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_latest_metrics_instance", columnNames = {"instance_id"})
        }
)
public class LatestMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instance_id", nullable = false)
    private InstanceEntity instanceEntity;

    private Double cpuUsage;
    private Double memoryUsage;
    private Double diskUsage;
    private Double diskIops;
    private Double networkIn;
    private Double networkOut;

    private Boolean isValid;

    private String errorType;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private LocalDateTime collectedAt;
    private LocalDateTime updatedAt;
}

