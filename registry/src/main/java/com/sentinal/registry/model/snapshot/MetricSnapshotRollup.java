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
        name = "metrics_snapshot_rollup",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_rollup_instance_bucket_window_valid",
                        columnNames = {"instance_id", "bucket_start", "bucket_minutes", "is_valid"}
                )
        },
        indexes = {
                @Index(name = "idx_rollup_instance_bucket", columnList = "instance_id,bucket_start"),
                @Index(name = "idx_rollup_bucket_window", columnList = "bucket_minutes,bucket_start")
        }
)
public class MetricSnapshotRollup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instance_id", nullable = false)
    private InstanceEntity instanceEntity;

    @Column(name = "bucket_start", nullable = false)
    private LocalDateTime bucketStart;

    @Column(name = "bucket_minutes", nullable = false)
    private Integer bucketMinutes;

    @Column(name = "is_valid", nullable = false)
    private Boolean isValid;

    @Column(name = "sample_count", nullable = false)
    private Long sampleCount;

    private Double cpuAvg;
    private Double cpuMin;
    private Double cpuMax;
    private Double cpuP95;

    private Double memoryAvg;
    private Double memoryMin;
    private Double memoryMax;
    private Double memoryP95;

    private Double diskAvg;
    private Double diskMin;
    private Double diskMax;
    private Double diskP95;

    private Double networkInAvg;
    private Double networkInMin;
    private Double networkInMax;
    private Double networkInP95;

    private Double networkOutAvg;
    private Double networkOutMin;
    private Double networkOutMax;
    private Double networkOutP95;
}

