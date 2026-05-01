import asyncio
import json
import re
from typing import Any

from app.sambanova_client import ask_sambanova
from app.tools import (
    get_instance,
    get_latest_metrics,
    get_recent_anomalies,
    get_recent_snapshots,
    get_snapshot,
)

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

    identity_patterns = (
        "what is your name",
        "what's your name",
        "who are you",
        "introduce yourself",
    )
    if any(pattern in normalized for pattern in identity_patterns):
        return True

    # Keep greetings strict so incident prompts containing words like "this"
    # do not accidentally match the short greeting "hi".
    greeting_pattern = r"^(hello|hi|hey)[\s!.?,]*$"
    return re.fullmatch(greeting_pattern, normalized) is not None


def plan_tools(user_question: str | None, snapshot_id: int | None) -> list[str]:
    question = (user_question or "").lower()
    tools = ["get_instance"]

    if snapshot_id:
        tools.append("get_snapshot")
    else:
        tools.append("get_latest_metrics")

    if any(word in question for word in ["current", "now", "still", "live", "health", "slow"]):
        tools.append("get_latest_metrics")

    if any(word in question for word in ["history", "previous", "again", "recurring", "recent", "latest"]):
        tools.append("get_recent_snapshots")

    if any(word in question for word in ["anomaly", "spike", "cpu", "memory", "disk", "root cause"]):
        tools.append("get_recent_anomalies")

    return _dedupe(tools)


async def analyze_instance(
    instance_id: str,
    user_question: str | None = None,
    snapshot_id: int | None = None,
    agent_context: dict[str, Any] | None = None,
    allowed_tools: list[str] | None = None,
    chat_history: list[dict[str, str]] | None = None,
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
            "tools_used": [],
        })

    context = await gather_context(
        instance_id=instance_id,
        snapshot_id=snapshot_id,
        user_question=user_question,
        allowed_tools=allowed_tools,
        provided_agent_context=agent_context,
        chat_history=chat_history,
    )
    compact_history = _compact_chat_history(chat_history)

    prompt = f"""
You are Sentinal AI, a read-only incident analysis agent.

You selected and executed these tools:
{json.dumps(context["tool_plan"], indent=2)}

Tool results:
{json.dumps(context, indent=2, default=str)}

Recent chat history:
{json.dumps(compact_history, indent=2)}

User question:
{user_question or "Analyze the instance health and suggest measures."}

Return JSON:
{{
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "root_cause": "...",
  "evidence": ["..."],
  "recommended_actions": ["..."],
  "auto_executable": false,
  "tools_used": []
}}

Rules:
- Do not invent metrics.
- If metrics are missing, say metrics are unavailable.
- Treat missing metrics differently from zero metrics.
- Use only the tool results as evidence.
- tools_used must exactly match the successful tools listed in tool_results.tools_used.
- Do not claim that you used tools listed in tool_errors.
- Use chat history to understand follow-up references like "this spike", "that issue", or "what next".
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


async def gather_context(
    instance_id: str,
    snapshot_id: int | None,
    user_question: str | None,
    allowed_tools: list[str] | None = None,
    provided_agent_context: dict[str, Any] | None = None,
    chat_history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    allowed = _sanitize_allowed_tools(allowed_tools)
    plan = _filter_planned_tools(plan_tools(user_question, snapshot_id), allowed)
    context: dict[str, Any] = {
        "tool_plan": plan,
        "tools_used": [],
        "tool_errors": [],
    }

    if isinstance(provided_agent_context, dict) and provided_agent_context:
        context["providedContext"] = _compact_agent_context(provided_agent_context)

    compact_history = _compact_chat_history(chat_history)
    if compact_history:
        context["chatHistory"] = compact_history

    if "get_instance" in plan:
        await _collect_tool_result(context, "get_instance", "instance", get_instance(instance_id))

    if "get_latest_metrics" in plan:
        await _collect_tool_result(
            context,
            "get_latest_metrics",
            "latestMetrics",
            get_latest_metrics(instance_id),
        )

    if "get_snapshot" in plan and snapshot_id is not None:
        await _collect_tool_result(
            context,
            "get_snapshot",
            "selectedSnapshot",
            get_snapshot(instance_id, snapshot_id),
        )

    if "get_recent_snapshots" in plan:
        await _collect_tool_result(
            context,
            "get_recent_snapshots",
            "recentSnapshots",
            get_recent_snapshots(instance_id),
        )

    if "get_recent_anomalies" in plan:
        await _collect_tool_result(
            context,
            "get_recent_anomalies",
            "recentAnomalies",
            get_recent_anomalies(instance_id),
        )

    return context


async def _collect_tool_result(
    context: dict[str, Any],
    tool_name: str,
    result_key: str,
    awaitable: Any,
) -> None:
    try:
        context[result_key] = await awaitable
        context["tools_used"].append(tool_name)
    except Exception as exc:
        context["tool_errors"].append({
            "tool": tool_name,
            "error": f"{type(exc).__name__}: {exc}",
        })


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


def _sanitize_allowed_tools(allowed_tools: list[str] | None) -> list[str]:
    known_tools = {
        "get_instance",
        "get_latest_metrics",
        "get_snapshot",
        "get_recent_snapshots",
        "get_recent_anomalies",
    }
    if not isinstance(allowed_tools, list):
        return []
    sanitized: list[str] = []
    for tool in allowed_tools:
        if not isinstance(tool, str):
            continue
        normalized = tool.strip()
        if normalized in known_tools and normalized not in sanitized:
            sanitized.append(normalized)
    return sanitized


def _filter_planned_tools(planned_tools: list[str], allowed_tools: list[str]) -> list[str]:
    if not allowed_tools:
        return []
    return [tool for tool in planned_tools if tool in allowed_tools]


def _compact_chat_history(chat_history: list[dict[str, str]] | None) -> list[dict[str, str]]:
    if not isinstance(chat_history, list):
        return []
    compacted: list[dict[str, str]] = []
    for message in chat_history[-10:]:
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "").strip().lower()
        content = str(message.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        compacted.append({
            "role": role,
            "content": content[:1200],
        })
    return compacted


def _dedupe(items: list[str]) -> list[str]:
    deduped: list[str] = []
    for item in items:
        if item not in deduped:
            deduped.append(item)
    return deduped


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
