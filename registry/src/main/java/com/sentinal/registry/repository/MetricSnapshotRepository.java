package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MetricSnapshotRepository extends JpaRepository<MetricsSnapshot, Long>
{
    List<MetricsSnapshot> findByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    List<MetricsSnapshot> findTop10ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
}
