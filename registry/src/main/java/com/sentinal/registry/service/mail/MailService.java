package com.sentinal.registry.service.mail;

import com.sentinal.registry.model.instances.InstanceEntity;
import com.sentinal.registry.model.snapshot.IncidentSnapshot;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class MailService
{
    private final JavaMailSender mailSender;

    @Async
    public void sendTerminationAlert(InstanceEntity instance, IncidentSnapshot incident)
    {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom("sentinalplatform@gmail.com");
            helper.setTo(instance.getUser().getEmail());
            helper.setSubject("[SENTINAL ALERT] Instance " + instance.getInstanceId() + " has been TERMINATED");
            helper.setText(buildEmailBody(instance,incident), true);
            mailSender.send(message);
            log.info("Termination alert sent to {} for instance {}",instance.getUser().getEmail(), instance.getInstanceId());
        } catch (Exception e) {
            log.error("Failed to send termination email for instance {}: {}",instance.getInstanceId(), e.getMessage());
        }
    }

    private String buildEmailBody(InstanceEntity instance, IncidentSnapshot incident)
    {
        long durationMinutes = java.time.Duration.between(
                incident.getIncidentStartTime(),
                incident.getIncidentEndTime()
        ).toMinutes();

        String instanceId  = instance.getInstanceId();
        String region      = instance.getRegion();
        String nickname    = instance.getNickname() != null ? instance.getNickname() : "-";
        String startTime   = incident.getIncidentStartTime().toString();
        String endTime     = incident.getIncidentEndTime().toString();
        String quarantine  = instance.getQuarantineCount() + " / " + instance.getMaxQuarantineCycles();

        return "<html><body style=\"font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;\">"
                + "<div style=\"background: #c0392b; padding: 20px; border-radius: 8px 8px 0 0;\">"
                + "<h2 style=\"color: white; margin: 0;\">Instance Terminated</h2>"
                + "<p style=\"color: #fadbd8; margin: 4px 0 0;\">Sentinel Monitoring Alert</p>"
                + "</div>"
                + "<div style=\"border: 1px solid #e0e0e0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;\">"
                + "<p>Your instance has been terminated by Sentinel after exhausting all recovery attempts.</p>"
                + "<table style=\"width: 100%; border-collapse: collapse; margin: 16px 0;\">"
                + "<tr style=\"background: #f8f8f8;\"><td style=\"padding: 10px 12px; font-weight: bold;\">Instance ID</td><td style=\"padding: 10px 12px;\">" + instanceId + "</td></tr>"
                + "<tr><td style=\"padding: 10px 12px; font-weight: bold;\">Region</td><td style=\"padding: 10px 12px;\">" + region + "</td></tr>"
                + "<tr style=\"background: #f8f8f8;\"><td style=\"padding: 10px 12px; font-weight: bold;\">Nickname</td><td style=\"padding: 10px 12px;\">" + nickname + "</td></tr>"
                + "<tr><td style=\"padding: 10px 12px; font-weight: bold;\">Incident started</td><td style=\"padding: 10px 12px;\">" + startTime + "</td></tr>"
                + "<tr style=\"background: #f8f8f8;\"><td style=\"padding: 10px 12px; font-weight: bold;\">Incident ended</td><td style=\"padding: 10px 12px;\">" + endTime + "</td></tr>"
                + "<tr><td style=\"padding: 10px 12px; font-weight: bold;\">Total duration</td><td style=\"padding: 10px 12px;\">" + durationMinutes + " minutes</td></tr>"
                + "<tr style=\"background: #f8f8f8;\"><td style=\"padding: 10px 12px; font-weight: bold;\">Auto-reboots attempted</td><td style=\"padding: 10px 12px;\">" + quarantine + "</td></tr>"
                + "</table>"
                + "<div style=\"background: #fdf2f2; border-left: 4px solid #c0392b; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0;\">"
                + "<strong>What happened:</strong> The instance failed health checks repeatedly, was quarantined "
                + instance.getQuarantineCount() + " time(s), and did not recover after auto-reboot. Sentinel has marked it as TERMINATED."
                + "</div>"
                + "<p style=\"margin-top: 24px;\">Log into your Sentinel dashboard to view the full incident report including metrics at each state transition and AI-generated diagnosis.</p>"
                + "<p style=\"color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px;\">"
                + "This alert was sent by Sentinel Monitoring. You are receiving this because you registered instance " + instanceId + " under your account."
                + "</p></div></body></html>";
    }
}
