# AWS Deployment Guide for Registry Service

## Prerequisites

- AWS CLI configured
- Docker installed
- EC2 instance with appropriate IAM role

## 1. Create IAM Role for Registry Service

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:RebootInstances",
        "ec2:StartInstances",
        "ec2:StopInstances"
      ],
      "Resource": "*"
    }
  ]
}
```

## 2. Launch EC2 Instance

```bash
# Launch EC2 instance with the IAM role
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --iam-instance-profile Name=RegistryServiceRole \
  --user-data file://user-data.sh
```

## 3. User Data Script (user-data.sh)

```bash
#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Java 21
yum install -y java-21-amazon-corretto
```

## 4. Deploy Registry Service

```bash
# Copy your Registry Service to EC2
scp -r Registry-Service ec2-user@your-ec2-ip:~/

# SSH to EC2 and deploy
ssh ec2-user@your-ec2-ip

# Create docker-compose.yml for dependencies
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: sentinel
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:6.0-alpine
    ports:
      - "6379:6379"

volumes:
  mysql_data:
EOF

# Start dependencies
docker-compose up -d

# Build and run Registry Service
cd Registry-Service
./mvnw clean package
java -jar target/Registry-Service-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
```

## 5. Configure Security Groups

Allow inbound traffic:
- Port 8081 (Registry Service)
- Port 3306 (MySQL) - only from Registry Service
- Port 6379 (Redis) - only from Registry Service
- Port 22 (SSH) - from your IP only

## 6. Update ServiceA Configuration

```yaml
# application-prod.yml for ServiceA
registry:
  base-url: http://<registry-ec2-private-ip>:8081/registry

service:
  host: ${EC2_PRIVATE_IP}
```