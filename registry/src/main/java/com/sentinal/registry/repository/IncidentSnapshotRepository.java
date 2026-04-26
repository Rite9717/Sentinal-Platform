package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IncidentSnapshotRepository extends JpaRepository<IncidentSnapshot, Long>
{
    Optional<IncidentSnapshot> findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNull(String instanceId);
    List<IncidentSnapshot> findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNotNullOrderByIncidentStartTimeDesc(String instanceId);
    List<IncidentSnapshot> findTop10ByIncidentEndTimeIsNotNullOrderByIncidentEndTimeDesc();
    List<IncidentSnapshot> findTop5ByInstanceEntity_InstanceIdOrderByIncidentStartTimeDesc(String instanceId);
    Optional<IncidentSnapshot> findFirstByInstanceEntity_InstanceIdAndIncidentEndTimeIsNotNullOrderByIncidentEndTimeDesc(String instanceId);
}
