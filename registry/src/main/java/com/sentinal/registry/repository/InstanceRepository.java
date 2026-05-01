package com.sentinal.registry.repository;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import com.sentinal.registry.model.snapshot.LatestMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstanceRepository extends JpaRepository<InstanceEntity, Long> {
    List<InstanceEntity> findByUserUsername(String username);
    List<InstanceEntity> findByStateNot(MonitorState state);
    Optional<InstanceEntity> findByInstanceId(String instanceId);
    boolean existsByInstanceId(String instanceId);
    boolean existsByInstanceIdAndUserUsername(String instanceId, String username);

    @Query("""
            SELECT latest
            FROM LatestMetrics latest
            WHERE latest.instanceEntity.id = :instanceId
            """)
    Optional<LatestMetrics> findLatestMetricsByInstanceEntityId(@Param("instanceId") Long instanceId);

}
