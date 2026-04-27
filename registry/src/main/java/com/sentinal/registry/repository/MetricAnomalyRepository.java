package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.MetricAnomaly;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MetricAnomalyRepository extends JpaRepository<MetricAnomaly, Long> {

    Optional<MetricAnomaly> findByInstanceEntity_InstanceIdAndMetricNameAndResolvedAtIsNull(
            String instanceId,
            String metricName
    );

    List<MetricAnomaly> findByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByCreatedAtDesc(String instanceId);

    List<MetricAnomaly> findTop20ByInstanceEntity_InstanceIdOrderByCreatedAtDesc(String instanceId);

    @Query("""
            SELECT a
            FROM MetricAnomaly a
            WHERE a.instanceEntity.instanceId = :instanceId
            ORDER BY a.createdAt DESC
            """)
    List<MetricAnomaly> findRecentByInstanceId(@Param("instanceId") String instanceId);
}
