import asyncio
import json
from typing import Any

from app.sambanova_client import ask_sambanova

MODEL_TIMEOUT_SECONDS = 120


def _trim(items: list[Any], limit: int) -> list[Any]:
    if not isinstance(items, list):
        return []
    return items[:limit]


def _compact_instance(instance: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": instance.get("id"),
        "instanceId": instance.get("instanceId"),
        "nickname": instance.get("nickname"),
        "region": instance.get("region"),
        "state": instance.get("state"),
        "lastError": instance.get("lastError"),
        "suspectCount": instance.get("suspectCount"),
        "quarantineCount": instance.get("quarantineCount"),
        "stateChangedAt": instance.get("stateChangedAt"),
    }


def _compact_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": snapshot.get("id"),
        "collectedAt": snapshot.get("collectedAt"),
        "isValid": snapshot.get("isValid"),
        "cpuUsage": snapshot.get("cpuUsage"),
        "memoryUsage": snapshot.get("memoryUsage"),
        "diskUsage": snapshot.get("diskUsage"),
        "networkIn": snapshot.get("networkIn"),
        "networkOut": snapshot.get("networkOut"),
        "errorType": snapshot.get("errorType"),
        "errorMessage": snapshot.get("errorMessage"),
    }


def _compact_anomaly(anomaly: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": anomaly.get("id"),
        "metricName": anomaly.get("metricName"),
        "metricValue": anomaly.get("metricValue"),
        "threshold": anomaly.get("threshold"),
        "severity": anomaly.get("severity"),
        "instanceState": anomaly.get("instanceState"),
        "message": anomaly.get("message"),
        "createdAt": anomaly.get("createdAt"),
    }


def _compact_incident(incident: dict[str, Any]) -> dict[str, Any]:
    timeline = incident.get("metricsTimeline")
    timeline_preview = None
    if isinstance(timeline, str):
        timeline_preview = timeline[:700]

    return {
        "id": incident.get("id"),
        "status": incident.get("status"),
        "severity": incident.get("severity"),
        "startedAt": incident.get("startedAt"),
        "resolvedAt": incident.get("resolvedAt"),
        "stateTransition": incident.get("stateTransition"),
        "triggerReason": incident.get("triggerReason"),
        "resolution": incident.get("resolution"),
        "lastGoodSnapshotId": incident.get("lastGoodSnapshotId"),
        "metricsTimelinePreview": timeline_preview,
    }


def _is_general_chat_question(question: str | None) -> bool:
    if not question:
        return False

    normalized = question.strip().lower()
    if not normalized:
        return False

    general_patterns = (
        "what is your name",
        "what's your name",
        "who are you",
        "introduce yourself",
        "hello",
        "hi",
        "hey",
    )
    return any(pattern in normalized for pattern in general_patterns)


async def analyze_instance(
    instance_id: str,
    user_question: str | None = None,
    snapshot_id: int | None = None,
    agent_context: dict[str, Any] | None = None,
) -> str:
    if _is_general_chat_question(user_question):
        return json.dumps({
            "severity": "INFO",
            "root_cause": "I am Sentinal AI, your infrastructure incident analysis assistant.",
            "evidence": [
                "The user asked a general identity question, not an incident-analysis question."
            ],
            "recommended_actions": [
                "Select a snapshot and ask an incident question when you want root cause analysis."
            ],
            "auto_executable": False,
        })

    snapshot_context = agent_context if isinstance(agent_context, dict) else {}
    compact_context = _compact_agent_context(snapshot_context)

    prompt = f"""
You are an agentic AI for cloud instance monitoring.
Analyze ONLY the selected lifecycle snapshot JSON provided below and recommend what the user should do.

User question:
{user_question or "Analyze the instance health and suggest measures."}

Selected incident snapshot id:
{snapshot_id if snapshot_id is not None else "not provided"}

Selected lifecycle snapshot JSON:
{json.dumps(compact_context, default=str)}

Return only JSON in this format:
{{
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "root_cause": "...",
  "evidence": ["..."],
  "recommended_actions": ["..."],
  "auto_executable": false
}}

Rules:
- Do not invent metrics.
- If metrics are missing, say metrics are unavailable.
- Treat missing metrics differently from zero metrics.
- Use only the selected lifecycle snapshot JSON as evidence.
- Use anomaly snapshots before incident events to detect early warning signs.
- Recommend safe actions first.
"""

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(ask_sambanova, prompt),
            timeout=MODEL_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError(f"SambaNova request exceeded {MODEL_TIMEOUT_SECONDS}s timeout") from exc


def _compact_agent_context(context: dict[str, Any]) -> dict[str, Any]:
    if not context:
        return {
            "instance": {"instanceId": None, "state": None, "region": None},
            "latestMetrics": {},
            "activeAnomalies": [],
            "activeIncident": {},
            "incidentEvents": [],
        }

    return {
        "instance": context.get("instance") or {},
        "latestMetrics": context.get("latestMetrics") or {},
        "activeAnomalies": _trim_anomalies(context.get("activeAnomalies")),
        "activeIncident": context.get("activeIncident") or {},
        "incidentEvents": _trim(context.get("incidentEvents") or [], 12),
    }


def _trim_anomalies(anomalies: Any) -> list[dict[str, Any]]:
    compacted: list[dict[str, Any]] = []
    for anomaly in _trim(anomalies if isinstance(anomalies, list) else [], 4):
        if not isinstance(anomaly, dict):
            continue
        mapped = dict(anomaly)
        snapshots = mapped.get("snapshots")
        mapped["snapshots"] = _trim(snapshots if isinstance(snapshots, list) else [], 10)
        compacted.append(mapped)
    return compacted
