package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MetricSnapshotRepository extends JpaRepository<MetricsSnapshot, Long>
{
    List<MetricsSnapshot> findByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    List<MetricsSnapshot> findTop5ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    List<MetricsSnapshot> findTop10ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
    List<MetricsSnapshot> findTop20ByInstanceEntity_InstanceIdOrderBySnapshotTimeDesc(String instanceId);
}
