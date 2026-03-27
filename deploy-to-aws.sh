#!/bin/bash

# AWS ServiceA Deployment Script
# Usage: ./deploy-to-aws.sh <ec2-public-ip> <path-to-key-pair>

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <ec2-public-ip> <path-to-key-pair>"
    echo "Example: $0 54.123.45.67 ~/.ssh/my-key.pem"
    exit 1
fi

EC2_IP=$1
KEY_PAIR=$2

echo "🚀 Starting ServiceA deployment to AWS..."
echo "EC2 IP: $EC2_IP"
echo "Key Pair: $KEY_PAIR"

# Step 1: Build ServiceA
echo "📦 Building ServiceA..."
cd ServiceA
./mvnw clean package -q
cd ..

# Step 2: Copy JAR to EC2
echo "📤 Copying JAR to EC2..."
scp -i "$KEY_PAIR" -o StrictHostKeyChecking=no ServiceA/target/ServiceA-*.jar ec2-user@$EC2_IP:/tmp/

# Step 3: Setup EC2 instance
echo "⚙️ Setting up EC2 instance..."
ssh -i "$KEY_PAIR" -o StrictHostKeyChecking=no ec2-user@$EC2_IP << 'EOF'
# Update system and install Java
sudo yum update -y
sudo yum install -y java-21-amazon-corretto

# Create application directory
sudo mkdir -p /opt/servicea
sudo chown ec2-user:ec2-user /opt/servicea

# Move JAR file
mv /tmp/ServiceA-*.jar /opt/servicea/

# Create application configuration
cat > /opt/servicea/application-aws.yml << 'APPEOF'
spring:
  application:
    name: ServiceA

server:
  port: 9001

registry:
  base-url: ${REGISTRY_URL:http://localhost:8081/registry}

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

logging:
  level:
    com.project.ServiceA: INFO
  file:
    name: /var/log/servicea.log
APPEOF

# Create startup script
cat > /opt/servicea/start-servicea.sh << 'STARTEOF'
#!/bin/bash

# Get EC2 metadata
export SERVICE_HOST=$(curl -s http://169.254.169.254/latest/meta-data/local-ipv4)
export EC2_INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
export EC2_REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)

# Set Registry URL - UPDATE THIS!
export REGISTRY_URL="${REGISTRY_URL:-http://localhost:8081/registry}"

echo "Starting ServiceA..."
echo "Service Host: $SERVICE_HOST"
echo "EC2 Instance ID: $EC2_INSTANCE_ID"
echo "EC2 Region: $EC2_REGION"
echo "Registry URL: $REGISTRY_URL"

# Start the application
java -jar /opt/servicea/ServiceA-*.jar \
  --spring.profiles.active=aws \
  --spring.config.additional-location=file:/opt/servicea/application-aws.yml
STARTEOF

# Make script executable
chmod +x /opt/servicea/start-servicea.sh

# Create systemd service
sudo cat > /etc/systemd/system/servicea.service << 'SERVICEEOF'
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
Environment=REGISTRY_URL=http://localhost:8081/registry

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Reload systemd
sudo systemctl daemon-reload
sudo systemctl enable servicea

echo "✅ Setup completed!"
EOF

echo "🎉 Deployment completed!"
echo ""
echo "Next steps:"
echo "1. Update Registry URL:"
echo "   ssh -i $KEY_PAIR ec2-user@$EC2_IP"
echo "   nano /opt/servicea/start-servicea.sh"
echo "   # Update REGISTRY_URL line"
echo ""
echo "2. Start the service:"
echo "   sudo systemctl start servicea"
echo ""
echo "3. Check status:"
echo "   sudo systemctl status servicea"
echo "   curl http://$EC2_IP:9001/hello"
echo ""
echo "4. View logs:"
echo "   sudo journalctl -u servicea -f"