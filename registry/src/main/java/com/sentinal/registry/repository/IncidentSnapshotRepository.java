package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IncidentSnapshotRepository extends JpaRepository<IncidentSnapshot, Long>
{
    Optional<IncidentSnapshot> findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNull(String instanceId);
    List<IncidentSnapshot> findByInstanceEntity_InstanceIdAndIncidentEndTimeIsNotNullOrderByIncidentStartTimeDesc(String instanceId);
    List<IncidentSnapshot> findTop10ByIncidentEndTimeIsNotNullOrderByIncidentEndTimeDesc();
}
