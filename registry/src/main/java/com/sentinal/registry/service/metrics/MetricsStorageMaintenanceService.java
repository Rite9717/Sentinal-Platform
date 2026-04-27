package com.sentinal.registry.service.metrics;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.MetricSnapshotRollup;
import com.sentinal.registry.model.snapshot.MetricsSnapshot;
import com.sentinal.registry.repository.IncidentSnapshotRepository;
import com.sentinal.registry.repository.InstanceRepository;
import com.sentinal.registry.repository.MetricSnapshotRepository;
import com.sentinal.registry.repository.MetricSnapshotRollupRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class MetricsStorageMaintenanceService {

    private static final int BUCKET_ONE_MINUTE = 1;
    private static final int BUCKET_FIFTEEN_MINUTES = 15;

    private final InstanceRepository instanceRepository;
    private final MetricSnapshotRepository snapshotRepository;
    private final MetricSnapshotRollupRepository rollupRepository;
    private final IncidentSnapshotRepository incidentRepository;

    @Value("${sentinel.metrics.rollup.enabled:true}")
    private boolean rollupEnabled;

    @Value("${sentinel.metrics.rollup.lookback-minutes:180}")
    private int rollupLookbackMinutes;

    @Value("${sentinel.metrics.retention.enabled:true}")
    private boolean retentionEnabled;

    @Value("${sentinel.metrics.retention.raw-days:7}")
    private int rawRetentionDays;

    @Value("${sentinel.metrics.retention.rollup-1m-days:90}")
    private int rollupOneMinuteRetentionDays;

    @Value("${sentinel.metrics.retention.rollup-15m-days:365}")
    private int rollupFifteenMinuteRetentionDays;

    @Value("${sentinel.metrics.retention.batch-size:1000}")
    private int retentionBatchSize;

    @Scheduled(fixedDelayString = "${sentinel.metrics.rollup.job.one-minute.fixed-delay-ms:60000}")
    public void buildOneMinuteRollups() {
        buildRollups(BUCKET_ONE_MINUTE);
    }

    @Scheduled(fixedDelayString = "${sentinel.metrics.rollup.job.fifteen-minute.fixed-delay-ms:300000}")
    public void buildFifteenMinuteRollups() {
        buildRollups(BUCKET_FIFTEEN_MINUTES);
    }

    @Scheduled(fixedDelayString = "${sentinel.metrics.retention.job.fixed-delay-ms:3600000}")
    @Transactional
    public void purgeExpiredMetricsData() {
        if (!retentionEnabled) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        int rawDeleted = purgeRawSnapshots(now);
        long rollupOneMinuteDeleted = purgeRollups(BUCKET_ONE_MINUTE, rollupOneMinuteRetentionDays, now);
        long rollupFifteenMinuteDeleted = purgeRollups(BUCKET_FIFTEEN_MINUTES, rollupFifteenMinuteRetentionDays, now);

        if (rawDeleted > 0 || rollupOneMinuteDeleted > 0 || rollupFifteenMinuteDeleted > 0) {
            log.info("Metrics retention cleanup completed: rawDeleted={}, rollup1mDeleted={}, rollup15mDeleted={}",
                    rawDeleted, rollupOneMinuteDeleted, rollupFifteenMinuteDeleted);
        }
    }

    private void buildRollups(int bucketMinutes) {
        if (!rollupEnabled) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime endExclusive = floorToBucket(now, bucketMinutes);
        LocalDateTime startInclusive = endExclusive.minusMinutes(Math.max(rollupLookbackMinutes, bucketMinutes));

        if (!startInclusive.isBefore(endExclusive)) {
            return;
        }

        int totalRollupsSaved = 0;
        long totalSamplesProcessed = 0;
        List<InstanceEntity> instances = instanceRepository.findAll();

        for (InstanceEntity instance : instances) {
            List<MetricsSnapshot> snapshots = snapshotRepository
                    .findByInstanceEntity_IdAndCollectedAtGreaterThanEqualAndCollectedAtLessThanOrderByCollectedAtAsc(
                            instance.getId(),
                            startInclusive,
                            endExclusive
                    );

            if (snapshots.isEmpty()) {
                continue;
            }

            Map<RollupKey, RollupAccumulator> grouped = new LinkedHashMap<>();
            for (MetricsSnapshot snapshot : snapshots) {
                LocalDateTime collectedAt = snapshot.getCollectedAt() != null
                        ? snapshot.getCollectedAt()
                        : snapshot.getSnapshotTime();
                if (collectedAt == null || !collectedAt.isBefore(endExclusive) || collectedAt.isBefore(startInclusive)) {
                    continue;
                }

                RollupKey key = new RollupKey(
                        floorToBucket(collectedAt, bucketMinutes),
                        Boolean.TRUE.equals(snapshot.getIsValid())
                );
                grouped.computeIfAbsent(key, ignored -> new RollupAccumulator())
                        .add(snapshot);
            }

            if (grouped.isEmpty()) {
                continue;
            }

            List<MetricSnapshotRollup> toSave = new ArrayList<>();
            for (Map.Entry<RollupKey, RollupAccumulator> entry : grouped.entrySet()) {
                RollupKey key = entry.getKey();
                RollupAccumulator accumulator = entry.getValue();

                MetricSnapshotRollup rollup = rollupRepository
                        .findByInstanceEntity_IdAndBucketStartAndBucketMinutesAndIsValid(
                                instance.getId(),
                                key.bucketStart(),
                                bucketMinutes,
                                key.valid()
                        )
                        .orElseGet(() -> MetricSnapshotRollup.builder()
                                .instanceEntity(instance)
                                .bucketStart(key.bucketStart())
                                .bucketMinutes(bucketMinutes)
                                .isValid(key.valid())
                                .build());

                accumulator.applyTo(rollup);
                totalSamplesProcessed += accumulator.sampleCount();
                toSave.add(rollup);
            }

            rollupRepository.saveAll(toSave);
            totalRollupsSaved += toSave.size();
        }

        if (totalRollupsSaved > 0) {
            log.debug("Rollup refresh done for {}-minute bucket: rollupsSaved={}, samplesProcessed={}",
                    bucketMinutes, totalRollupsSaved, totalSamplesProcessed);
        }
    }

    private int purgeRawSnapshots(LocalDateTime now) {
        if (rawRetentionDays <= 0) {
            return 0;
        }

        LocalDateTime cutoff = now.minusDays(rawRetentionDays);
        List<Long> protectedSnapshotIds = incidentRepository.findDistinctLastGoodSnapshotIds();
        int batchSize = Math.max(50, retentionBatchSize);
        int totalDeleted = 0;

        while (true) {
            Pageable page = PageRequest.of(0, batchSize);
            List<MetricsSnapshot> batch = protectedSnapshotIds.isEmpty()
                    ? snapshotRepository.findByCollectedAtLessThanOrderByCollectedAtAsc(cutoff, page)
                    : snapshotRepository.findByCollectedAtLessThanAndIdNotInOrderByCollectedAtAsc(cutoff, protectedSnapshotIds, page);

            if (batch.isEmpty()) {
                break;
            }

            snapshotRepository.deleteAllInBatch(batch);
            totalDeleted += batch.size();

            if (batch.size() < batchSize) {
                break;
            }
        }

        return totalDeleted;
    }

    private long purgeRollups(int bucketMinutes, int retentionDays, LocalDateTime now) {
        if (retentionDays <= 0) {
            return 0L;
        }
        LocalDateTime cutoff = now.minusDays(retentionDays);
        return rollupRepository.deleteByBucketMinutesAndBucketStartBefore(bucketMinutes, cutoff);
    }

    private LocalDateTime floorToBucket(LocalDateTime value, int bucketMinutes) {
        LocalDateTime floored = value.withSecond(0).withNano(0);
        int minute = floored.getMinute();
        int flooredMinute = minute - (minute % bucketMinutes);
        return floored.withMinute(flooredMinute);
    }

    private record RollupKey(LocalDateTime bucketStart, boolean valid) {
    }

    private static final class RollupAccumulator {
        private long sampleCount;
        private final List<Double> cpu = new ArrayList<>();
        private final List<Double> memory = new ArrayList<>();
        private final List<Double> disk = new ArrayList<>();
        private final List<Double> networkIn = new ArrayList<>();
        private final List<Double> networkOut = new ArrayList<>();

        void add(MetricsSnapshot snapshot) {
            sampleCount++;
            addValue(cpu, snapshot.getCpuUsage());
            addValue(memory, snapshot.getMemoryUsage());
            addValue(disk, snapshot.getDiskUsage());
            addValue(networkIn, snapshot.getNetworkIn());
            addValue(networkOut, snapshot.getNetworkOut());
        }

        long sampleCount() {
            return sampleCount;
        }

        void applyTo(MetricSnapshotRollup rollup) {
            rollup.setSampleCount(sampleCount);

            rollup.setCpuAvg(avg(cpu));
            rollup.setCpuMin(min(cpu));
            rollup.setCpuMax(max(cpu));
            rollup.setCpuP95(percentile95(cpu));

            rollup.setMemoryAvg(avg(memory));
            rollup.setMemoryMin(min(memory));
            rollup.setMemoryMax(max(memory));
            rollup.setMemoryP95(percentile95(memory));

            rollup.setDiskAvg(avg(disk));
            rollup.setDiskMin(min(disk));
            rollup.setDiskMax(max(disk));
            rollup.setDiskP95(percentile95(disk));

            rollup.setNetworkInAvg(avg(networkIn));
            rollup.setNetworkInMin(min(networkIn));
            rollup.setNetworkInMax(max(networkIn));
            rollup.setNetworkInP95(percentile95(networkIn));

            rollup.setNetworkOutAvg(avg(networkOut));
            rollup.setNetworkOutMin(min(networkOut));
            rollup.setNetworkOutMax(max(networkOut));
            rollup.setNetworkOutP95(percentile95(networkOut));
        }

        private void addValue(List<Double> target, Double value) {
            if (value != null) {
                target.add(value);
            }
        }

        private Double avg(List<Double> values) {
            if (values.isEmpty()) {
                return null;
            }
            return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        }

        private Double min(List<Double> values) {
            if (values.isEmpty()) {
                return null;
            }
            return values.stream().mapToDouble(Double::doubleValue).min().orElse(0.0);
        }

        private Double max(List<Double> values) {
            if (values.isEmpty()) {
                return null;
            }
            return values.stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
        }

        private Double percentile95(List<Double> values) {
            if (values.isEmpty()) {
                return null;
            }
            List<Double> sorted = new ArrayList<>(values);
            sorted.sort(Double::compareTo);
            int index = (int) Math.ceil(sorted.size() * 0.95) - 1;
            index = Math.max(0, Math.min(index, sorted.size() - 1));
            return sorted.get(index);
        }
    }
}

