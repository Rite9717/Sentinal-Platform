package com.sentinal.registry.repository;

import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiAnalysisRepository extends JpaRepository<IncidentSnapshot, Long>
{
    List<IncidentSnapshot> findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullOrderByIncidentEndTimeDesc(String instanceId);

    List<IncidentSnapshot> findByAiAnalysisIsNotNullOrderByIncidentEndTimeDesc();

    long countByInstanceEntity_InstanceIdAndAiAnalysisIsNotNull(String instanceId);

    List<IncidentSnapshot> findByInstanceEntity_InstanceIdAndAiAnalysisIsNotNullAndResolutionOrderByIncidentEndTimeDesc(
            String instanceId, MonitorState resolution);
}
