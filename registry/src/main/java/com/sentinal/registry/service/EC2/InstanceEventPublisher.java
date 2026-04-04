package com.sentinal.registry.service.EC2;

import com.sentinal.registry.model.instances.InstanceEntity;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InstanceEventPublisher
{
    private final SimpMessagingTemplate messageTemplate;
    public void publish(InstanceEntity instance, String message)
    {
        log.info("[EVENT] Instance: {} | State: {} | Message: {}",
                instance.getInstanceId(),
                instance.getState(),
                message
        );
        messageTemplate.convertAndSend(
                "/topic/instances/" + instance.getUser().getId(),
                Map.of(
                        "instanceId",instance.getInstanceId(),
                        "state",instance.getState(),
                        "message",message,
                        "timestamp",System.currentTimeMillis()
                )
        );
    }
}
