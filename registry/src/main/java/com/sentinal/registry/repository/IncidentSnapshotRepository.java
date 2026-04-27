package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IncidentSnapshotRepository extends JpaRepository<IncidentSnapshot, Long>
{
    List<IncidentSnapshot> findByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc(String instanceId);
    Optional<IncidentSnapshot> findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNullOrderByStartedAtDesc(String instanceId);
    List<IncidentSnapshot> findByInstanceEntity_InstanceIdAndResolvedAtIsNotNullOrderByStartedAtDesc(String instanceId);
    List<IncidentSnapshot> findTop10ByResolvedAtIsNotNullOrderByResolvedAtDesc();
    List<IncidentSnapshot> findTop5ByInstanceEntity_InstanceIdOrderByStartedAtDesc(String instanceId);
    List<IncidentSnapshot> findTop20ByInstanceEntity_InstanceIdOrderByStartedAtDesc(String instanceId);
    Optional<IncidentSnapshot> findFirstByInstanceEntity_InstanceIdAndResolvedAtIsNotNullOrderByResolvedAtDesc(String instanceId);
    List<IncidentSnapshot> findByInstanceEntity_InstanceIdAndLastGoodSnapshotIdOrderByStartedAtDesc(
            String instanceId,
            Long lastGoodSnapshotId
    );

    @Query("""
            SELECT DISTINCT i.lastGoodSnapshotId
            FROM IncidentSnapshot i
            WHERE i.lastGoodSnapshotId IS NOT NULL
            """)
    List<Long> findDistinctLastGoodSnapshotIds();
}
