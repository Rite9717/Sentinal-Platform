package com.sentinal.registry.service.EC2;

import com.sentinal.registry.model.instances.InstanceEntity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class InstanceEventPublisher
{

    public void publish(InstanceEntity instance, String message) {
        // For now just log — later hook in email/Slack/webhook
        log.info("[EVENT] Instance: {} | State: {} | Message: {}",
                instance.getInstanceId(),
                instance.getState(),
                message
        );
        // TODO: send email / webhook / websocket push to frontend
    }
}
