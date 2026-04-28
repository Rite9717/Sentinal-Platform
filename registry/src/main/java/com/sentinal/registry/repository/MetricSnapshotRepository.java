package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface MetricSnapshotRepository extends JpaRepository<MetricsSnapshot, Long>
{
    List<MetricsSnapshot> findByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    List<MetricsSnapshot> findTop5ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    List<MetricsSnapshot> findTop10ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    List<MetricsSnapshot> findTop20ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    Optional<MetricsSnapshot> findTopByInstanceEntity_InstanceIdOrderByCollectedAtDesc(String instanceId);
    Optional<MetricsSnapshot> findTopByInstanceEntity_InstanceIdAndIsValidTrueOrderByCollectedAtDesc(String instanceId);
    Optional<MetricsSnapshot> findTopByInstanceEntity_IdAndIsValidTrueOrderByCollectedAtDesc(Long instanceId);
    List<MetricsSnapshot> findTop20ByInstanceEntity_InstanceIdOrderByCollectedAtDesc(String instanceId);
    List<MetricsSnapshot> findTop20ByInstanceEntity_IdOrderByCollectedAtDesc(Long instanceId);
    List<MetricsSnapshot> findTop20ByInstanceEntity_InstanceIdAndCollectedAtLessThanEqualOrderByCollectedAtDesc(
            String instanceId,
            LocalDateTime collectedAt
    );
    List<MetricsSnapshot> findByInstanceEntity_IdAndCollectedAtAfterOrderByCollectedAtDesc(Long instanceId, LocalDateTime collectedAt);
    List<MetricsSnapshot> findByInstanceEntity_IdAndCollectedAtGreaterThanEqualAndCollectedAtLessThanOrderByCollectedAtAsc(
            Long instanceEntityId,
            LocalDateTime startInclusive,
            LocalDateTime endExclusive
    );
    List<MetricsSnapshot> findByAnomaly_IdOrderByCollectedAtAsc(Long anomalyId);
    List<MetricsSnapshot> findByCollectedAtLessThanOrderByCollectedAtAsc(LocalDateTime cutoff, Pageable pageable);
    List<MetricsSnapshot> findByCollectedAtLessThanAndIdNotInOrderByCollectedAtAsc(
            LocalDateTime cutoff,
            Collection<Long> excludedIds,
            Pageable pageable
    );
    @Query("""
            SELECT m
            FROM MetricsSnapshot m
            WHERE m.instanceEntity.instanceId = :instanceId
            ORDER BY m.collectedAt DESC
            """)
    List<MetricsSnapshot> findRecentByInstanceId(@Param("instanceId") String instanceId);
    Optional<MetricsSnapshot> findTopByInstanceEntity_IdAndIsValidTrueAndSnapshotTypeInOrderByCollectedAtDesc(
            Long instanceId,
            List<com.sentinal.registry.model.snapshot.MetricSnapshotType> types
    );
}
