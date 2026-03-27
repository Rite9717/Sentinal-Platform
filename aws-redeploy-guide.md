# Complete AWS Deployment Guide for ServiceA

## Step 1: Prepare Your Local Environment

### 1.1 Build ServiceA JAR
```bash
cd ServiceA
./mvnw clean package
```

### 1.2 Verify JAR was created
```bash
ls -la target/ServiceA-*.jar
```

## Step 2: Create EC2 Instance

### 2.1 Launch EC2 Instance via AWS Console
1. Go to AWS Console → EC2 → Launch Instance
2. **Name**: `ServiceA-Instance`
3. **AMI**: Amazon Linux 2023 AMI
4. **Instance Type**: t3.micro (free tier) or t3.small
5. **Key Pair**: Create new or use existing
6. **Security Group**: Create new with these rules:
   - SSH (22) - Your IP only
   - Custom TCP (9001) - Anywhere (0.0.0.0/0)
   - HTTP (80) - Anywhere (optional)
7. **Storage**: 8 GB gp3 (default)
8. Click **Launch Instance**

### 2.2 Alternative: Launch via AWS CLI
```bash
# Create security group
aws ec2 create-security-group \
  --group-name ServiceA-SG \
  --description "Security group for ServiceA"

# Add rules to security group
aws ec2 authorize-security-group-ingress \
  --group-name ServiceA-SG \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-name ServiceA-SG \
  --protocol tcp \
  --port 9001 \
  --cidr 0.0.0.0/0

# Launch instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --count 1 \
  --instance-type t3.micro \
  --key-name your-key-pair-name \
  --security-groups ServiceA-SG \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ServiceA-Instance}]'
```

## Step 3: Connect to EC2 Instance

### 3.1 Get Instance Details
```bash
# Get public IP
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=ServiceA-Instance" \
  --query 'Reservations[*].Instances[*].PublicIpAddress' \
  --output text
```

### 3.2 SSH to Instance
```bash
ssh -i your-key-pair.pem ec2-user@<PUBLIC_IP>
```

## Step 4: Setup EC2 Instance

### 4.1 Install Java 21
```bash
# Update system
sudo yum update -y

# Install Java 21
sudo yum install -y java-21-amazon-corretto

# Verify installation
java -version
```

### 4.2 Create Application Directory
```bash
# Create app directory
sudo mkdir -p /opt/servicea
sudo chown ec2-user:ec2-user /opt/servicea
cd /opt/servicea
```

## Step 5: Deploy ServiceA

### 5.1 Copy JAR to EC2
```bash
# From your local machine (new terminal)
scp -i your-key-pair.pem ServiceA/target/ServiceA-*.jar ec2-user@<PUBLIC_IP>:/opt/servicea/
```

### 5.2 Create Application Configuration
```bash
# On EC2 instance, create application-aws.yml
cat > /opt/servicea/application-aws.yml << 'EOF'
spring:
  application:
    name: ServiceA

server:
  port: 9001

# Registry configuration - update with your Registry Service URL
registry:
  base-url: ${REGISTRY_URL:http://localhost:8081/registry}

# Service configuration - auto-detect EC2 details
service:
  host: ${SERVICE_HOST:localhost}

management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      show-details: always

# Logging
logging:
  level:
    com.project.ServiceA: INFO
  file:
    name: /var/log/servicea.log
EOF
```

### 5.3 Create Startup Script
```bash
# Create startup script
cat > /opt/servicea/start-servicea.sh << 'EOF'
#!/bin/bash

# Get EC2 metadata
export SERVICE_HOST=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
export EC2_INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
export EC2_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

# Set Registry URL - UPDATE THIS WITH YOUR REGISTRY SERVICE URL
export REGISTRY_URL="http://localhost:8081/registry"  # Change this!

echo "Starting ServiceA..."
echo "Service Host: $SERVICE_HOST"
echo "EC2 Instance ID: $EC2_INSTANCE_ID"
echo "EC2 Region: $EC2_REGION"
echo "Registry URL: $REGISTRY_URL"

# Start the application
java -jar /opt/servicea/ServiceA-*.jar \
  --spring.profiles.active=aws \
  --spring.config.additional-location=file:/opt/servicea/application-aws.yml
EOF

# Make script executable
chmod +x /opt/servicea/start-servicea.sh
```

### 5.4 Create Systemd Service (Optional - for auto-start)
```bash
# Create systemd service file
sudo cat > /etc/systemd/system/servicea.service << 'EOF'
[Unit]
Description=ServiceA Spring Boot Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/servicea
ExecStart=/opt/servicea/start-servicea.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable servicea
```

## Step 6: Configure Registry Connection

### 6.1 Option A: Use ngrok (Quick Test)
```bash
# On your local machine, expose Registry Service
ngrok http 8081

# Note the public URL (e.g., https://abc123.ngrok.io)
# Update the startup script on EC2:
export REGISTRY_URL="https://abc123.ngrok.io/registry"
```

### 6.2 Option B: Deploy Registry Service to AWS (Production)
Follow the aws-deployment.md guide to deploy Registry Service to AWS, then use internal AWS networking.

## Step 7: Start ServiceA

### 7.1 Update Registry URL
```bash
# Edit the startup script with your actual Registry URL
nano /opt/servicea/start-servicea.sh

# Update this line:
export REGISTRY_URL="https://your-ngrok-url.ngrok.io/registry"
```

### 7.2 Start the Service
```bash
# Option A: Run directly
cd /opt/servicea
./start-servicea.sh

# Option B: Use systemd service
sudo systemctl start servicea
sudo systemctl status servicea

# View logs
sudo journalctl -u servicea -f
```

## Step 8: Verify Deployment

### 8.1 Check Service Health
```bash
# Test health endpoint
curl http://localhost:9001/actuator/health

# Test service endpoint
curl http://localhost:9001/hello
```

### 8.2 Check Registry Connection
```bash
# Check if service registered (from your local machine)
curl http://localhost:8081/registry/instances/sample-service-a

# Or if using ngrok
curl https://your-ngrok-url.ngrok.io/registry/instances/sample-service-a
```

### 8.3 Monitor Logs
```bash
# View application logs
tail -f /var/log/servicea.log

# View systemd logs
sudo journalctl -u servicea -f
```

## Step 9: Test from External Access

### 9.1 Get Public IP
```bash
# Get your EC2 public IP
curl http://169.254.169.254/latest/meta-data/public-ipv4
```

### 9.2 Test External Access
```bash
# From your local machine
curl http://<EC2_PUBLIC_IP>:9001/hello
curl http://<EC2_PUBLIC_IP>:9001/actuator/health
```

## Troubleshooting

### Common Issues:

1. **Service won't start**
   ```bash
   # Check Java version
   java -version
   
   # Check JAR file
   ls -la /opt/servicea/ServiceA-*.jar
   
   # Run with verbose logging
   java -jar ServiceA-*.jar --debug
   ```

2. **Can't connect to Registry**
   ```bash
   # Test network connectivity
   curl -v http://your-registry-url/actuator/health
   
   # Check environment variables
   env | grep REGISTRY
   ```

3. **Port 9001 not accessible**
   ```bash
   # Check security group allows port 9001
   # Check if service is listening
   sudo netstat -tlnp | grep 9001
   ```

4. **EC2 metadata not accessible**
   ```bash
   # Test metadata service
   curl http://169.254.169.254/latest/meta-data/instance-id
   ```

## Quick Commands Summary

```bash
# Build locally
cd ServiceA && ./mvnw clean package

# Copy to EC2
scp -i key.pem ServiceA/target/ServiceA-*.jar ec2-user@<IP>:/opt/servicea/

# On EC2: Install Java and start
sudo yum install -y java-21-amazon-corretto
cd /opt/servicea && ./start-servicea.sh

# Test
curl http://<EC2_IP>:9001/hello
```