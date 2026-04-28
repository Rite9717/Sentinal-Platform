# Sentinal Platform

Sentinal is a cloud instance monitoring, recovery, and AI incident-analysis platform for AWS EC2. It lets users register EC2 instances from their own AWS accounts, monitor live health and Prometheus metrics, automatically recover unhealthy instances, and analyze meaningful metric/incident snapshots with Sentinal AI.

The platform is built around one core idea: do not store noisy metric history forever. Store live metrics continuously, but persist historical snapshots only when something meaningful happens.

---

## What It Does

Sentinal monitors registered EC2 instances every 15 seconds.

It combines:

- AWS EC2 health checks for instance availability.
- Prometheus metrics for CPU, memory, disk, network, and load.
- A deterministic recovery state machine.
- Event-based metric snapshots for abnormal behavior.
- AI-ready lifecycle snapshots for chat-based analysis.

Instance state flow:

```text
UP -> SUSPECT -> QUARANTINED -> auto start/reboot -> UP
                                      |
                                      v
                                TERMINATED
```

| State | Meaning |
|---|---|
| `UP` | Instance health checks are passing |
| `SUSPECT` | Instance has started failing checks and is accumulating strikes |
| `QUARANTINED` | Max strikes reached, cooldown begins, auto-recovery is triggered |
| `TERMINATED` | Max quarantine cycles exceeded and manual intervention is required |

Metric spikes do not automatically mean the instance is down. Sentinal tracks metric anomalies separately, then links them to incident evidence when the instance state actually degrades.

---

## Current Architecture

```text
React Frontend
  |
  v
Spring Boot Registry Service
  |        |             |
  |        |             +--> Sentinal AI FastAPI service
  |        |                       |
  |        |                       +--> SambaNova API
  |        |
  |        +--> Prometheus / node_exporter / Grafana
  |
  +--> AWS STS AssumeRole -> EC2 APIs
```

Users do not provide long-lived AWS credentials to Sentinal. They create an IAM role in their AWS account, and Sentinal assumes that role using AWS STS and a unique ExternalId.

---

## Tech Stack

**Backend**

- Java 25
- Spring Boot 3.5
- Spring Security with JWT and Google OAuth2
- Spring Data JPA
- MySQL
- AWS SDK v2 for EC2 and STS
- Prometheus PromQL integration
- WebSocket updates for live instance status
- Spring Mail for incident notifications

**Frontend**

- React
- Tailwind CSS utility classes
- Axios
- Modern dashboard, fixed sidebar, instance cards, Grafana metric view, and snapshot chat workflow

**AI Service**

- Python FastAPI
- SambaNova Cloud API
- Default model should be the lower-cost available model configured in `.env`, currently expected as `DeepSeek-V3.1-cb`
- Receives selected snapshot JSON from Spring and analyzes only that snapshot

---

## Key Features

- User registration and login with JWT.
- Google OAuth2 login.
- Profile update except email.
- EC2 instance registration with account ID, instance ID, region, and IAM role/stack onboarding flow.
- Guided monitoring setup for node_exporter, Prometheus, and Grafana.
- Live instance dashboard with state, strikes, quarantine cycles, reset/remove actions, and Open Chat.
- Grafana metrics panel with refresh support.
- Automatic state transitions: `UP`, `SUSPECT`, `QUARANTINED`, `TERMINATED`.
- Auto start/reboot during quarantine.
- Latest live metrics are updated every monitoring cycle.
- Normal metrics are not saved as historical snapshots.
- Missing metrics are stored as unavailable, not fake zeroes.
- Metric anomalies are tracked as lifecycle events.
- Spike snapshots are saved only for abnormal metric behavior.
- AI chat lets the user select an instance, select a snapshot, edit a prompt, and send that snapshot to AI.

---

## Metric Storage Design

Sentinal separates live metric state from historical evidence.

### `latest_metrics`

Stores the current live metric state for each instance.

Used for:

- Dashboard display.
- Baseline comparison.
- Detecting metric spikes and sustained climbs.

Normal valid metrics update `latest_metrics` only. They do not create historical snapshots.

When metrics are unavailable:

- `is_valid=false`
- metric values remain `null` where unavailable
- error fields explain the issue
- no fake `0` values are saved

### `metrics_snapshot`

Stores meaningful event points only.

Snapshot types include:

- `PRE_SPIKE`
- `SPIKE_START`
- `SPIKE`
- `PEAK`
- `RECOVERY`
- `STATE_CHANGE`
- `BASELINE`

Examples:

- A CPU spike starts.
- A new peak is observed.
- The metric recovers.
- Instance state changes from `UP` to `SUSPECT`.

### `metric_anomaly`

Tracks the lifecycle of abnormal metrics.

An anomaly can be:

- `ACTIVE`
- `RESOLVED`

Trigger types:

- `SUDDEN_SPIKE`
- `SUSTAINED_SPIKE`
- `THRESHOLD_BREACH`

The backend avoids duplicate anomaly spam. If an active anomaly already exists for the same instance and metric, it updates that anomaly instead of creating a new row.

---

## Smart Anomaly Detection

Sentinal does not treat tiny relative changes as incidents.

For example:

```text
0.5% CPU -> 1% CPU
```

This is a 100% relative increase, but it is operationally normal. Sentinal does not create a snapshot for this anymore.

### Hard Threshold Rules

- CPU `> 90%`
- Memory `> 85%`
- Disk `> 90%`

### Sudden Spike Rules

A sudden spike must be both relative and meaningful.

CPU sudden spike:

- relative increase `>= 20%`
- current CPU `>= 25%`
- absolute increase `>= 10 percentage points`

Memory sudden spike:

- relative increase `>= 20%`
- current memory `>= 70%`
- absolute increase `>= 10 percentage points`

Disk sudden spike:

- relative increase `>= 20%`
- current disk `>= 80%`
- absolute increase `>= 5 percentage points`

### Sustained Climb Rules

Sentinal also catches slow ramps before they hit the hard threshold.

Example:

```text
10 -> 15 -> 20 -> 25 -> 30
```

This creates a `SUSTAINED_SPIKE` even though no single jump is huge.

Current sustained-climb rules:

- CPU: at least 5 rising checks, current CPU `>= 30%`, total rise from baseline `>= 20 points`
- Memory: at least 5 rising checks, current memory `>= 70%`, total rise from baseline `>= 15 points`
- Disk: at least 3 rising checks, current disk `>= 80%`, total rise from baseline `>= 5 points`

---

## AI Snapshot Format

When a meaningful spike lifecycle is saved, Sentinal stores an AI-ready JSON payload in `incident_snapshot.ai_context`.

Shape:

```json
{
  "instance": {
    "instanceId": "i-123",
    "state": "SUSPECT",
    "region": "ap-south-1"
  },
  "latestMetrics": {
    "cpuUsage": 84.2,
    "memoryUsage": 71.5,
    "diskUsage": 55.0,
    "isValid": true,
    "collectedAt": "2026-04-28T10:32:00"
  },
  "activeAnomalies": [
    {
      "metricName": "CPU",
      "status": "ACTIVE",
      "triggerType": "SUSTAINED_SPIKE",
      "baselineValue": 38.0,
      "startValue": 82.0,
      "currentValue": 84.2,
      "peakValue": 88.7,
      "spikePercentage": 115.7,
      "startedAt": "2026-04-28T10:25:00",
      "durationMinutes": 7,
      "snapshots": [
        {
          "type": "PRE_SPIKE",
          "cpuUsage": 38.0,
          "collectedAt": "2026-04-28T10:24:45"
        },
        {
          "type": "SPIKE_START",
          "cpuUsage": 82.0,
          "collectedAt": "2026-04-28T10:25:00"
        },
        {
          "type": "PEAK",
          "cpuUsage": 88.7,
          "collectedAt": "2026-04-28T10:29:00"
        }
      ]
    }
  ],
  "activeIncident": {
    "status": "ACTIVE",
    "startState": "SUSPECT",
    "triggerReason": "Health check failed after sustained CPU spike",
    "startedAt": "2026-04-28T10:31:00"
  },
  "incidentEvents": [
    {
      "eventType": "SUSPECT_STARTED",
      "message": "Instance moved from UP to SUSPECT",
      "createdAt": "2026-04-28T10:31:00"
    }
  ]
}
```

The frontend does not dump this raw JSON into chat anymore. It shows a readable snapshot attachment summary, while the full JSON is sent to Sentinal AI in the background.

---

## Chat Analysis Flow

The chat screen works like this:

1. User selects an instance.
2. User selects a lifecycle snapshot.
3. Frontend fetches `/api/instances/{id}/incidents/{incidentId}/ai-snapshot`.
4. User edits the prompt or chooses a preset.
5. User presses Send.
6. Spring sends the selected snapshot JSON plus the prompt to Sentinal AI.
7. Sentinal AI analyzes only that snapshot and returns:
   - severity
   - root cause
   - evidence
   - recommended actions
   - whether the action is auto-executable
8. Spring saves the AI response back to the incident snapshot.

The selected snapshot is automatically attached when the user presses Send.

General questions such as “what is your name?” are handled as general Sentinal AI questions instead of forcing a fake incident analysis.

---

## Getting Started

### Prerequisites

- Java 25
- Node.js 18+
- MySQL 8+
- Python 3.11+
- Prometheus
- node_exporter installed on monitored instances
- Grafana configured for the monitored instance metrics
- AWS account with IAM permissions

### 1. Clone

```bash
git clone https://github.com/Rite9717/Sentinal-Platform.git
cd Sentinal-Platform
```

### 2. Configure Backend

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

sentinel:
  ai:
    service:
      url: http://localhost:8000
      enabled: true
      timeout: 240000
  metrics:
    prometheus:
      cpu-rate-window: 1m
    anomaly:
      sudden-spike-percent: 20.0
      spike-snapshot-interval-seconds: 60

jwt:
  secret: YOUR_JWT_SECRET
  expiration: 86400000
```

Never commit local secrets.

### 3. Run Backend

```bash
cd registry
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Backend runs on `http://localhost:8080`.

### 4. Configure Sentinal AI

Create `Sentinal AI/.env`:

```env
SAMBANOVA_API_KEY=your_api_key
SAMBANOVA_BASE_URL=https://api.sambanova.ai/v1
SAMBANOVA_MODEL=DeepSeek-V3.1-cb
SAMBANOVA_FALLBACK_MODELS=gemma-3-12b-it
SAMBANOVA_REQUEST_TIMEOUT=120
SAMBANOVA_MAX_TOKENS=900
SPRING_BACKEND_URL=http://localhost:8080
```

Run:

```bash
cd "Sentinal AI"
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

AI service runs on `http://localhost:8000`.

### 5. Run Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000`.

---

## Registering an EC2 Instance

The frontend onboarding flow guides the user through:

1. Account ID
2. Instance ID
3. Region
4. IAM role or CloudFormation stack creation
5. node_exporter installation
6. Prometheus setup
7. Grafana setup

API registration endpoint:

```http
POST /api/instances/register
Authorization: Bearer <jwt>

{
  "instanceId": "i-0abc123def456789",
  "region": "us-east-1",
  "nickname": "Production Server",
  "roleArn": "arn:aws:iam::123456789012:role/SentinalMonitorRole"
}
```

---

## Important API Endpoints

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register user |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/oauth2/authorization/google` | Google OAuth2 login |
| `PUT` | `/api/auth/profile` | Update profile except email |

### Instances

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/instances` | List registered instances |
| `GET` | `/api/instances/{id}` | Get one instance |
| `POST` | `/api/instances/register` | Register EC2 instance |
| `GET` | `/api/instances/{id}/metrics` | Fetch live Prometheus metrics |
| `POST` | `/api/instances/{id}/reset` | Reset Sentinal state back to UP |
| `DELETE` | `/api/instances/{id}` | Remove instance from Sentinal |

Manual AWS start/reboot commands are currently used by the auto-recovery path inside quarantine. Public start/stop/reboot REST endpoints are not exposed in the current controller.

### Snapshots and AI

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/instances/{id}/incidents` | Recent incident/spike lifecycle snapshots |
| `GET` | `/api/instances/{id}/incidents/active` | Active incident/snapshot |
| `GET` | `/api/instances/{id}/incidents/{incidentId}/ai-snapshot` | Structured AI snapshot JSON |
| `GET` | `/api/instances/{id}/incidents/{incidentId}/ai-context` | Backward-compatible alias for AI snapshot |
| `POST` | `/api/instances/{id}/incidents/{incidentId}/analyze` | Analyze selected snapshot with AI |
| `PATCH` | `/api/instances/{id}/incidents/{incidentId}/ai-analysis` | Store/update AI analysis |
| `GET` | `/api/instances/ai/health` | Check AI service health |

### Sentinal AI Service

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check |
| `POST` | `/agent/analyze-instance` | Analyze one selected snapshot |

Expected AI service payload:

```json
{
  "instance_id": "i-123",
  "snapshot_id": 11,
  "user_question": "Explain the first degraded metric and remediation.",
  "agent_context": {
    "instance": {},
    "latestMetrics": {},
    "activeAnomalies": [],
    "activeIncident": {},
    "incidentEvents": []
  }
}
```

---

## IAM Permissions Required

The monitored account role needs:

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

```text
Sentinal Platform/
├── Sentinal AI/
│   ├── app/
│   │   ├── main.py
│   │   ├── agent.py
│   │   ├── models.py
│   │   ├── config.py
│   │   └── sambanova_client.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── hooks/
└── registry/
    └── src/main/java/com/sentinal/registry/
        ├── controller/
        ├── dto/
        ├── model/
        │   ├── instances/
        │   ├── snapshot/
        │   └── user/
        ├── repository/
        ├── service/
        │   ├── EC2/
        │   ├── ai/
        │   ├── auth/
        │   ├── mail/
        │   ├── metrics/
        │   └── scheduler/
        └── config/
```

---

## Testing

Backend:

```bash
cd registry
./mvnw test
```

Frontend:

```bash
cd frontend
npm run build
```

Python syntax check:

```bash
python3 -m py_compile "Sentinal AI/app/agent.py" "Sentinal AI/app/main.py" "Sentinal AI/app/models.py"
```

---

## Security Notes

- Never commit `.env` or `application-local.yaml`.
- User AWS access uses STS AssumeRole and ExternalId.
- JWT protects authenticated endpoints.
- OAuth2 is supported for Google login.
- Users can only access their own instances and snapshots.
- Missing metrics are never stored as fake zeroes.

---

## License

MIT
