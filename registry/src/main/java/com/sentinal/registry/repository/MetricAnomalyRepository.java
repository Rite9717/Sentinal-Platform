package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.MetricAnomaly;
import com.sentinal.registry.model.snapshot.AnomalyStatus;
import com.sentinal.registry.model.snapshot.MetricName;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MetricAnomalyRepository extends JpaRepository<MetricAnomaly, Long> {

    Optional<MetricAnomaly> findTopByInstanceEntity_IdAndMetricNameAndStatusOrderByStartedAtDesc(
            Long instanceId,
            MetricName metricName,
            AnomalyStatus status
    );

    List<MetricAnomaly> findByInstanceEntity_IdAndStatusOrderByStartedAtDesc(Long instanceId, AnomalyStatus status);

    List<MetricAnomaly> findTop20ByInstanceEntity_IdOrderByStartedAtDesc(Long instanceId);

    // Backward-compatible queries used by existing services.
    List<MetricAnomaly> findByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByCreatedAtDesc(String instanceId);
    List<MetricAnomaly> findTop20ByInstanceEntity_InstanceIdOrderByCreatedAtDesc(String instanceId);

    @Query("""
            SELECT a
            FROM MetricAnomaly a
            WHERE a.instanceEntity.id = :instanceId
            ORDER BY a.startedAt DESC
            """)
    List<MetricAnomaly> findRecentByInstanceId(@Param("instanceId") Long instanceId);

    @Query("""
            SELECT a
            FROM MetricAnomaly a
            WHERE a.instanceEntity.instanceId = :instanceId
            ORDER BY a.createdAt DESC
            """)
    List<MetricAnomaly> findRecentByInstanceId(@Param("instanceId") String instanceId);

    @Query("""
            SELECT a
            FROM MetricAnomaly a
            WHERE a.instanceEntity.id = :instanceId
            AND a.status = com.sentinal.registry.model.snapshot.AnomalyStatus.ACTIVE
            ORDER BY a.startedAt DESC
            """)
    List<MetricAnomaly> findActiveByInstanceId(@Param("instanceId") Long instanceId);
}
