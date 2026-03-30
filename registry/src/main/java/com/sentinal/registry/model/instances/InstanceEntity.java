package com.sentinal.registry.model.instances;

import com.sentinal.registry.model.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "instances")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstanceEntity
{

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String instanceId;        // AWS instance ID
    private String region;
    private String nickname;
    private String roleArn;
    private String externalId;

    @Enumerated(EnumType.STRING)
    private MonitorState state;      // UP, SUSPECT, QUARANTINED, TERMINATED

    private int suspectCount;         // consecutive failures
    private int quarantineCount;      // how many times quarantined

    private Long lastCheckedAt;
    private Long stateChangedAt;
    private Long quarantineUntil;     // epoch ms — when quarantine lifts

    private String lastError;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;
}