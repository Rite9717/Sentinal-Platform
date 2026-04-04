package com.sentinal.registry.service.EC2;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ec2.Ec2Client;
import software.amazon.awssdk.services.ec2.model.*;
import software.amazon.awssdk.services.sts.StsClient;
import software.amazon.awssdk.services.sts.model.AssumeRoleRequest;
import software.amazon.awssdk.services.sts.model.AssumeRoleResponse;
import software.amazon.awssdk.services.sts.model.Credentials;
import software.amazon.awssdk.services.ec2.model.RebootInstancesRequest;
import java.util.Map;
import java.util.HashMap;

@Service
public class EC2HealthService
{

    //private final Ec2Client ec2Client;
    private final StsClient stsClient;

//    public EC2HealthService(@Value("${aws.region}") String region,
//                            @Value("${aws.accessKeyId}") String accessKeyId,
//                            @Value("${aws.secretAccessKey}") String secretKey){
//        this.ec2Client = Ec2Client.builder()
//                .region(Region.of(region))
//                .credentialsProvider(
//                        StaticCredentialsProvider.create(
//                                AwsBasicCredentials.create(accessKeyId, secretKey)
//                        )
//                )
//                .build();
//    }

    public EC2HealthService(@Value("${aws.region}") String region,
                            @Value("${aws.accessKeyId}") String accessKeyId,
                            @Value("${aws.secretAccessKey}") String secretKey){
        StaticCredentialsProvider appCredentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretKey));
        this.stsClient = StsClient.builder()
                .region(Region.of(region))
                .credentialsProvider(appCredentials)
                .build();
    }

    private Ec2Client getEc2ClientForUser(String userRoleArn, String externalId, String region)
    {
        AssumeRoleRequest assumeRoleRequest = AssumeRoleRequest.builder()
                .roleArn(userRoleArn)           // "arn:aws:iam::USER_ACCOUNT:role/SentinalMonitorRole"
                .roleSessionName("SentinalHealthCheck")
                .externalId(externalId)         // security: unique per user
                .durationSeconds(900)           // 15 min temp credentials
                .build();

        AssumeRoleResponse response = stsClient.assumeRole(assumeRoleRequest);
        Credentials tempCreds = response.credentials();

        return Ec2Client.builder()
                .region(Region.of(region))
                .credentialsProvider(
                        StaticCredentialsProvider.create(
                                AwsSessionCredentials.create(tempCreds.accessKeyId(),tempCreds.secretAccessKey(),tempCreds.sessionToken())
                        )
                )
                .build();
    }


    public Map<String, Object> getInstanceHealth(String instanceId, String roleArn, String externalId, String region)
    {
        try {
            Ec2Client ec2Client = getEc2ClientForUser(roleArn, externalId, region);
            // 1. Get instance state (running/stopped etc.)
            DescribeInstancesResponse instanceRes = ec2Client.describeInstances(
                    DescribeInstancesRequest.builder()
                            .instanceIds(instanceId)
                            .build()
            );

            Instance instance = instanceRes.reservations()
                    .get(0).instances().get(0);

            String instanceState = instance.state().nameAsString(); // "running", "stopped", etc.

            // 2. Get system + instance status checks
            DescribeInstanceStatusResponse statusRes = ec2Client.describeInstanceStatus(
                    DescribeInstanceStatusRequest.builder()
                            .instanceIds(instanceId)
                            .includeAllInstances(true) // includes stopped instances too
                            .build()
            );

            Map<String, Object> result = new HashMap<>();
            result.put("instanceId", instanceId);
            result.put("instanceState", instanceState);

            if (!statusRes.instanceStatuses().isEmpty()) {
                InstanceStatus status = statusRes.instanceStatuses().get(0);
                result.put("systemStatus", status.systemStatus().statusAsString());    // "ok", "impaired"
                result.put("instanceStatus", status.instanceStatus().statusAsString()); // "ok", "impaired"
            } else {
                result.put("systemStatus", "unavailable");
                result.put("instanceStatus", "unavailable");
            }

            // 3. Overall health summary
            boolean isHealthy = "running".equals(instanceState)
                    && ("ok".equals(result.get("systemStatus")) || "initializing".equals(result.get("systemStatus")))
                    && ("ok".equals(result.get("instanceStatus")) || "initializing".equals(result.get("instanceStatus")));

            result.put("healthy", isHealthy);
            return result;

        } catch (Ec2Exception e) {
            return Map.of(
                    "instanceId", instanceId,
                    "healthy", false,
                    "error", e.getMessage()
            );
        }
    }

    public Map<String, Object> startInstance(String instanceId, String roleArn,
                                             String externalId,String region)
    {
        try {
            Ec2Client ec2Client = getEc2ClientForUser(roleArn,externalId, region);
            ec2Client.startInstances(StartInstancesRequest.builder()
                    .instanceIds(instanceId)
                    .build()
            );

            return Map.of(
                    "instanceId", instanceId,
                    "action", "Start",
                    "success", true,
                    "message","Start command sent successfully"
            );
        }
        catch (Ec2Exception e)
        {
            return Map.of(
                    "instanceId", instanceId,
                    "action", "START",
                    "success", false,
                    "error", e.getMessage()
            );
        }
    }
    public Map<String, Object> rebootInstance(String instanceId, String roleArn,
                                              String externalId,String region)
    {
        try {
            Ec2Client ec2Client = getEc2ClientForUser(roleArn, externalId, region);
            ec2Client.rebootInstances(RebootInstancesRequest.builder()
                    .instanceIds(instanceId)
                    .build()
            );

            return Map.of(
                    "instanceId", instanceId,
                    "action", "Reboot",
                    "success", true,
                    "message","Reboot command sent successfully"
            );
        }
        catch (Ec2Exception e)
        {
            return Map.of(
                    "instanceId", instanceId,
                    "action", "REBOOT",
                    "success", false,
                    "error", e.getMessage()
            );
        }
    }
}
