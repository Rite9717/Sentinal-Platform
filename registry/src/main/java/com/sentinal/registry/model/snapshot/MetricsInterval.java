package com.sentinal.registry.model.snapshot;

import com.sentinal.registry.model.instances.MonitorState;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class MetricsInterval
{
    private MonitorState state;
    private LocalDateTime capturedAt;
    private Double cpuUsage;
    private Double memoryUsage;
    private Double diskUsage;
    private Double networkIn;
    private Double networkOut;
    private Double systemLoad;
    private String note;
}
