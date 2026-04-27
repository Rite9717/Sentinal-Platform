package com.sentinal.registry.repository;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.instances.MonitorState;
import org.springframework.data.jpa.repository.JpaRepository;
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

}
