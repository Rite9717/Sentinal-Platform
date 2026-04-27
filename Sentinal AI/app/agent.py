import asyncio
import json
from typing import Any

from app.sambanova_client import ask_sambanova
from app.spring_tools import get_incidents, get_instance, get_recent_anomalies, get_recent_snapshots

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


async def analyze_instance(
    instance_id: str,
    user_question: str | None = None,
    snapshot_id: int | None = None,
) -> str:
    instance_raw = await get_instance(instance_id)
    snapshots_raw = await get_recent_snapshots(instance_id)
    anomalies_raw = await get_recent_anomalies(instance_id)
    incidents_raw = await get_incidents(instance_id)

    selected_incident_raw = None
    if snapshot_id is not None:
        for incident in incidents_raw:
            if str(incident.get("id")) == str(snapshot_id):
                selected_incident_raw = incident
                break

    compact_instance = _compact_instance(instance_raw)
    compact_snapshots = [_compact_snapshot(item) for item in _trim(snapshots_raw, 4)]
    compact_anomalies = [_compact_anomaly(item) for item in _trim(anomalies_raw, 4)]
    compact_incidents = [_compact_incident(item) for item in _trim(incidents_raw, 4)]
    selected_incident = _compact_incident(selected_incident_raw) if selected_incident_raw else None

    prompt = f"""
You are an agentic AI for cloud instance monitoring.
Analyze the selected incident snapshot for this instance and recommend what the user should do.

User question:
{user_question or "Analyze the instance health and suggest measures."}

Selected incident snapshot id:
{snapshot_id if snapshot_id is not None else "not provided"}

Selected incident snapshot details:
{json.dumps(selected_incident, default=str)}

Instance:
{json.dumps(compact_instance, default=str)}

Recent metric snapshots (limited):
{json.dumps(compact_snapshots, default=str)}

Recent anomalies (limited):
{json.dumps(compact_anomalies, default=str)}

Recent incidents (limited):
{json.dumps(compact_incidents, default=str)}

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
- Prioritize the selected incident snapshot if provided.
- Use anomalies before incidents to detect early warning signs.
- Recommend safe actions first.
"""

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(ask_sambanova, prompt),
            timeout=MODEL_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError as exc:
        raise TimeoutError(f"SambaNova request exceeded {MODEL_TIMEOUT_SECONDS}s timeout") from exc
