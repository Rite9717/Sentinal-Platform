package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.IncidentEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentEventRepository extends JpaRepository<IncidentEvent, Long> {
    List<IncidentEvent> findByIncident_IdOrderByCreatedAtAsc(Long incidentId);
    List<IncidentEvent> findByInstanceEntity_IdOrderByCreatedAtDesc(Long instanceId);
    List<IncidentEvent> findTop50ByInstanceEntity_IdOrderByCreatedAtDesc(Long instanceId);
}

