# Sentinal Platform

Sentinal is an AI-powered EC2 instance monitoring and incident analysis platform. It lets users register cloud instances, monitor live health metrics, detect metric anomalies, track incident lifecycles, and use an agentic AI assistant to investigate root causes.

## Core Features

- User registration, login, JWT authentication, and profile update.
- EC2 instance registration with account ID, instance ID, region, and IAM/stack onboarding guidance.
- Prometheus-based CPU, memory, disk, network, and load monitoring.
- Grafana metrics view support.
- Intelligent metric storage using `latest_metrics` for live state and event-based snapshots for evidence.
- Metric anomaly lifecycle tracking.
- Incident lifecycle tracking for `SUSPECT`, `QUARANTINED`, `RECOVERED`, and `TERMINATED`.
- Agentic Sentinal AI chat with deterministic tool planning.
- Instance chat mode, snapshot chat mode, and follow-up questions.

## Project Structure

```text
Sentinal Platform/
├── registry/
├── frontend/
└── Sentinal AI/
```

## Prerequisites

- Java 21+
- Maven wrapper, included in `registry/`
- Node.js 18+
- Python 3.10+
- MySQL
- Prometheus, Node Exporter, and Grafana for monitored instances
- SambaNova API key for Sentinal AI analysis

## Backend: registry

Spring Boot backend responsible for authentication, instance management, monitoring, anomaly detection, incident tracking, and AI orchestration.

### Main Classes

```text
AuthController
InstanceController
SnapshotController
AgentToolsController

InstanceHealthScheduler
PrometheusService
LatestMetricsService
MetricAnomalyService
MetricLifecycleSnapshotService
InstanceStateService
IncidentSnapshotService
AiAnalysisService
SentinelAiClient
```

## Frontend: frontend

React frontend using Tailwind CSS utility classes.

### Screens

```text
Landing Page
Login Page
Register Page
Dashboard
Instance Registration Wizard
Metrics / Grafana View
Agentic AI Chat
```

### Chat Modes

```text
Instance Mode:
User selects only an instance and asks about current health, latest anomalies, or history.

Snapshot Mode:
User selects a past snapshot and asks questions about that exact lifecycle event.
```

## Sentinal AI: Sentinal AI

FastAPI service using SambaNova for incident analysis.

### Main Files

```text
app/main.py
app/models.py
app/agent.py
app/tools.py
app/sambanova_client.py
```

## Agentic AI Flow

```text
User prompt
 -> Spring backend
 -> Sentinal AI FastAPI
 -> deterministic planner
 -> allowed tools
 -> tool execution
 -> SambaNova prompt
 -> JSON analysis
 -> Spring stores/displays result
```

## Agent Tools

```text
get_instance
get_latest_metrics
get_snapshot
get_recent_snapshots
get_recent_anomalies
```

### Tool Endpoints

```text
GET /api/agent/tools/instances/{instanceId}
GET /api/agent/tools/instances/{instanceId}/latest-metrics
GET /api/agent/tools/instances/{instanceId}/snapshots/{snapshotId}
GET /api/agent/tools/instances/{instanceId}/snapshots/recent
GET /api/agent/tools/instances/{instanceId}/anomalies/recent
```

## Database Tables

```text
users
instances
latest_metrics
metrics_snapshot
metrics_snapshot_rollup
metric_anomaly
incident_snapshot
incident_event
```

### Table Purpose

```text
users:
Stores platform users.

instances:
Stores registered EC2 instances and their current monitoring state.

latest_metrics:
Stores the latest live metric state per instance.

metrics_snapshot:
Stores meaningful metric evidence points like PRE_SPIKE, SPIKE_START, PEAK, RECOVERY.

metrics_snapshot_rollup:
Stores aggregated historical metrics.

metric_anomaly:
Stores anomaly lifecycle records.

incident_snapshot:
Stores incident/lifecycle snapshots and AI analysis context.

incident_event:
Stores structured timeline events for incidents.
```

## Monitoring Flow

```text
InstanceHealthScheduler
 -> PrometheusService
 -> LatestMetricsService
 -> MetricAnomalyService
 -> MetricsSnapshot
 -> InstanceStateService
 -> IncidentSnapshotService
```

## AI Analysis Flow

```text
Frontend chat
 -> SnapshotController
 -> AiAnalysisService
 -> SentinelAiClient
 -> FastAPI /agent/analyze-instance
 -> agent.py planner
 -> tools.py
 -> AgentToolsController
 -> SambaNova
 -> JSON response
 -> Frontend formatted response
```

## Environment Variables

### Backend

```env
DB_URL=jdbc:mysql://localhost:3306/sentinal_db?useSSL=false&serverTimezone=UTC&allowPublicKeyRetrieval=true
DB_USERNAME=root
DB_PASSWORD=
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
OAUTH2_REDIRECT_URI=http://localhost:3000/oauth2/callback
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
PROMETHEUS_URL=http://your-ec2-ip:9090
MAIL_USERNAME=
MAIL_PASSWORD=
SENTINEL_AI_URL=http://localhost:8000
SENTINEL_AI_ENABLED=true
```

### Sentinal AI

```env
SAMBANOVA_API_KEY=
SAMBANOVA_BASE_URL=https://api.sambanova.ai/v1
SAMBANOVA_MODEL=gemma-3-12b-it
SAMBANOVA_FALLBACK_MODELS=DeepSeek-V3.1-cb
SAMBANOVA_REQUEST_TIMEOUT=35
SAMBANOVA_MAX_TOKENS=450
SPRING_BACKEND_URL=http://localhost:8080
SENTINAL_AI_TOOLS_TOKEN=
```

### Frontend

```env
REACT_APP_GRAFANA_URL=
REACT_APP_GRAFANA_DASHBOARD_UID=
REACT_APP_GRAFANA_PANEL_CPU=
REACT_APP_GRAFANA_PANEL_MEMORY=
REACT_APP_GRAFANA_PANEL_DISK=
REACT_APP_GRAFANA_PANEL_NETWORK=
```

Do not commit real `.env`, API keys, AWS credentials, OAuth secrets, database passwords, or mail app passwords.

## Run Locally

### Backend

```bash
cd registry
./mvnw spring-boot:run
```

Backend:

```text
http://localhost:8080
```

### Sentinal AI

```bash
cd "Sentinal AI"
source venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

AI service:

```text
http://localhost:8000
```

### Frontend

```bash
cd frontend
npm start
```

Frontend:

```text
http://localhost:3000
```

## Test Commands

### Backend

```bash
cd registry
./mvnw test
```

### Frontend

```bash
cd frontend
npm run build
```

### Sentinal AI

```bash
cd "Sentinal AI"
python3 -m py_compile app/main.py app/agent.py app/models.py app/tools.py
```

## Health Checks

```bash
curl http://localhost:8000/
```

```bash
curl http://localhost:8080/api/instances/ai/health
```

## Current Agentic AI Status

Sentinal AI is currently a controlled deterministic agent.

```text
planner
 -> allowed tools
 -> tool execution
 -> context gathering
 -> SambaNova analysis
```

It does not use LangChain yet. Tool access is intentionally read-only and bounded by `allowed_tools`.
