package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.LatestMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LatestMetricsRepository extends JpaRepository<LatestMetrics, Long> {
    Optional<LatestMetrics> findByInstanceEntity_Id(Long instanceId);
}

