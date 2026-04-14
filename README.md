# Sentinal Platform

A cloud-native platform for monitoring and self-healing AWS EC2 instances. Users register their EC2 instances, monitor health in real time, and let the platform automatically recover failed instances — without manual intervention. When an instance cannot be recovered, Sentinal captures a full incident report, notifies the user by email, and generates an AI-ready diagnostic prompt.

---

## What it does

Sentinal continuously polls registered EC2 instances every 15 seconds using AWS APIs. If an instance starts failing health checks, it progresses through a deterministic recovery state machine:

```
UP → SUSPECT → QUARANTINED → (auto-reboot) → UP
                                  ↓
                             TERMINATED  (if max recovery cycles exceeded)
```

| State | Meaning |
|---|---|
| **UP** | All health checks passing |
| **SUSPECT** | Consecutive failures detected — accumulating strikes |
| **QUARANTINED** | Max strikes reached — auto-reboot triggered, cooldown applied |
| **TERMINATED** | Max recovery cycles exceeded — manual intervention required |

When an instance first leaves UP, Sentinal opens an **incident**. Metrics are captured at every state transition. When the incident resolves (recovered or terminated), the full timeline is sealed into a single snapshot and an email alert is sent to the user.

---

## Architecture

```
React Frontend
      ↓
Spring Boot Backend (Registry Service)
      ↓                          ↓
AWS STS (AssumeRole)       Prometheus (metrics)
      ↓
EC2 Health APIs (DescribeInstances, DescribeInstanceStatus)
```

The platform uses **cross-account IAM roles** — users never share AWS credentials. Instead, they create a minimal IAM role in their own AWS account that Sentinal assumes via STS. This is the same pattern used by Datadog, New Relic, and other cloud monitoring tools.

---

## Tech Stack

**Backend**
- Java 25 + Spring Boot 3.5
- Spring Security (JWT + Google OAuth2)
- AWS SDK v2 (EC2, STS)
- MySQL + Spring Data JPA
- Prometheus (metrics collection via PromQL)
- Spring Mail (incident email alerts)
- Scheduled health checks (every 15 seconds)

**Frontend**
- React
- Axios

---

## Features

- User registration and login (JWT + Google OAuth2)
- Register any EC2 instance across any AWS account
- Real-time health monitoring (instance state, system status, instance status checks)
- Automatic state transitions: UP → SUSPECT → QUARANTINED → TERMINATED
- Auto-reboot on quarantine
- Manual instance controls: reboot, stop, start
- Cross-account IAM role support via AWS STS AssumeRole
- Secure ExternalId per user to prevent confused deputy attacks
- **Incident snapshots** — one record per incident with metrics captured at every state transition
- **AI-ready diagnostic prompt** — each closed incident generates a plain-English prompt you can send directly to any AI for root cause analysis
- **Email alerts** — user is notified by email when their instance is terminated, including incident duration and auto-reboot attempts

---

## Getting Started

### Prerequisites

- Java 25
- Node.js 18+
- MySQL 8+
- Prometheus (with node_exporter running on monitored instances)
- AWS account with IAM permissions

### 1. Clone the repository

```bash
git clone https://github.com/Rite9717/Sentinal-Platform.git
cd Sentinal-Platform
```

### 2. Configure the backend

Create `registry/src/main/resources/application-local.yaml`:

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/sentinal_db
    username: your_db_username
    password: your_db_password

  security:
    oauth2:
      client:
        registration:
          google:
            client-id: YOUR_GOOGLE_CLIENT_ID
            client-secret: YOUR_GOOGLE_CLIENT_SECRET

  mail:
    host: smtp.gmail.com
    port: 587
    username: your-email@gmail.com
    password: your-gmail-app-password
    properties:
      mail.smtp.auth: true
      mail.smtp.starttls.enable: true

aws:
  region: us-east-1
  accessKeyId: YOUR_AWS_ACCESS_KEY
  secretAccessKey: YOUR_AWS_SECRET_KEY

prometheus:
  url: http://localhost:9090

jwt:
  secret: YOUR_JWT_SECRET
  expiration: 86400000
```

> **Never commit this file.** It is git-ignored by default.

> **Gmail users:** use an App Password, not your real password. Generate one at `Google Account → Security → 2-Step Verification → App Passwords`.

### 3. Run the backend

```bash
cd registry
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Backend runs on `http://localhost:8080`

### 4. Run the frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`

---

## Registering an EC2 Instance

### Step 1 — Create the IAM Role in your AWS account

Sentinal provides a CloudFormation template that creates a minimal IAM role in your AWS account.

1. Go to **AWS Console → CloudFormation → Create Stack → Upload a template file**
2. Upload `sentinal-monitor-role.yaml` (found in `registry/src/main/resources/`)
3. Enter your `ExternalId` (generated by Sentinal when you add an instance)
4. Submit — wait for `CREATE_COMPLETE`
5. Copy the **Role ARN** from the stack Outputs tab

### Step 2 — Register via the API

```http
POST /api/instances/register
Authorization: Bearer <your_jwt_token>

{
  "instanceId": "i-0abc123def456789",
  "region": "us-east-1",
  "nickname": "Production Server",
  "roleArn": "arn:aws:iam::123456789012:role/SentinalMonitorRole"
}
```

Once registered, the scheduler picks it up automatically and begins health monitoring.

---

## Incident Snapshots

Every time an instance leaves the UP state, Sentinal opens an incident. Metrics are fetched from Prometheus and recorded at each state transition — SUSPECT strikes, quarantine events, and the final resolution. When the incident closes (recovered or terminated), a single database record is sealed containing the full timeline.

### What a closed incident looks like

```
incident_start_time : 2026-04-13 10:15:00
incident_end_time   : 2026-04-13 10:37:45
resolution          : TERMINATED
metrics_timeline    : [ ...one entry per state transition... ]
ai_context          : full plain-English prompt ready to send to any AI
ai_analysis         : null (populated after you call an AI with the context)
```

Each entry in `metrics_timeline` contains the state, timestamp, note explaining the trigger, and CPU / memory / disk / network / load values at that moment.

### Email alert on termination

When an instance is terminated, the registered user receives an email containing the instance ID, region, nickname, incident duration, and number of auto-reboot attempts made.

---

## API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |
| GET | `/oauth2/authorization/google` | Google OAuth2 login |

### Instances

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/instances/register` | Register an EC2 instance |
| GET | `/api/instances` | List all instances for the logged-in user |
| GET | `/api/instances/{id}` | Get instance details and current state |
| GET | `/api/instances/{id}/metrics` | Live metrics from Prometheus right now |
| POST | `/api/instances/{id}/reboot` | Manually reboot an instance |
| POST | `/api/instances/{id}/stop` | Stop an instance |
| POST | `/api/instances/{id}/start` | Start a stopped instance |

### Incidents

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/instances/{id}/incidents` | All closed incidents, newest first |
| GET | `/api/instances/{id}/incidents/active` | Currently open incident, if any |
| GET | `/api/instances/{id}/incidents/{incidentId}/ai-context` | AI-ready diagnostic prompt for this incident |
| PATCH | `/api/instances/{id}/incidents/{incidentId}/ai-analysis` | Store AI response back into the incident record |

---

## IAM Permissions Required

The CloudFormation template creates a role with the following minimal permissions:

```json
{
  "Action": [
    "ec2:DescribeInstances",
    "ec2:DescribeInstanceStatus",
    "ec2:RebootInstances",
    "ec2:StopInstances",
    "ec2:StartInstances"
  ],
  "Effect": "Allow",
  "Resource": "*"
}
```

---

## Project Structure

```
Sentinal-Platform/
├── frontend/                        # React frontend
│   └── src/
│       ├── components/
│       └── services/
└── registry/                        # Spring Boot backend
    └── src/main/
        ├── java/com/sentinal/registry/
        │   ├── controller/          # REST controllers
        │   ├── service/
        │   │   ├── EC2/             # Health checks, state machine, instance controls
        │   │   ├── metrics/         # Prometheus integration
        │   │   ├── snapshot/        # Incident lifecycle and AI context generation
        │   │   ├── notification/    # Email alerts
        │   │   └── scheduler/       # 15-second health check scheduler
        │   ├── model/
        │   │   ├── instances/       # InstanceEntity, MonitorState
        │   │   ├── snapshot/        # IncidentSnapshot, MetricsInterval
        │   │   └── user/            # User entity
        │   ├── repository/          # Spring Data JPA repositories
        │   ├── security/            # JWT + OAuth2 config
        │   └── filter/              # JWT authentication filter
        └── resources/
            ├── application.yaml
            └── sentinal-monitor-role.yaml   # CloudFormation template
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `AWS_REGION` | AWS region for your Sentinal backend |
| `AWS_ACCESS_KEY_ID` | Sentinal's own AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Sentinal's own AWS secret key |
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret |
| `JWT_SECRET` | Secret key for signing JWT tokens |
| `OAUTH2_REDIRECT_URI` | OAuth2 callback URL (default: `http://localhost:3000/oauth2/callback`) |
| `PROMETHEUS_URL` | Prometheus base URL (default: `http://localhost:9090`) |
| `MAIL_USERNAME` | Gmail address for sending alerts |
| `MAIL_PASSWORD` | Gmail App Password (not your real password) |

---

## Security

- All secrets managed via environment variables — never hardcoded
- Cross-account access uses AWS STS AssumeRole with a unique `ExternalId` per user
- JWT tokens used for all authenticated API calls
- Google OAuth2 supported as an alternative login method
- Spring Security filters applied to all protected routes
- Incident data is scoped per user — users can only access their own instances and incidents

---

## License

MIT
