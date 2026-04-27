package com.sentinal.registry.repository;

import com.sentinal.registry.model.snapshot.MetricSnapshotRollup;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MetricSnapshotRollupRepository extends JpaRepository<MetricSnapshotRollup, Long> {

    Optional<MetricSnapshotRollup> findByInstanceEntity_IdAndBucketStartAndBucketMinutesAndIsValid(
            Long instanceEntityId,
            LocalDateTime bucketStart,
            Integer bucketMinutes,
            Boolean isValid
    );

    List<MetricSnapshotRollup> findByInstanceEntity_InstanceIdAndBucketMinutesOrderByBucketStartDesc(
            String instanceId,
            Integer bucketMinutes,
            Pageable pageable
    );

    List<MetricSnapshotRollup> findByInstanceEntity_InstanceIdAndBucketMinutesAndBucketStartGreaterThanEqualAndBucketStartLessThanEqualOrderByBucketStartAsc(
            String instanceId,
            Integer bucketMinutes,
            LocalDateTime start,
            LocalDateTime end
    );

    long deleteByBucketMinutesAndBucketStartBefore(Integer bucketMinutes, LocalDateTime cutoff);
}

