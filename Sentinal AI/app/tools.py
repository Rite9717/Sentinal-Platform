from typing import Any

import httpx

from app.config import SENTINAL_AI_TOOLS_TOKEN, SPRING_BACKEND_URL

TOOL_TIMEOUT_SECONDS = 10


def _tool_headers() -> dict[str, str]:
    if not SENTINAL_AI_TOOLS_TOKEN:
        return {}
    return {"X-Sentinal-AI-Token": SENTINAL_AI_TOOLS_TOKEN}


async def _get(path: str) -> Any:
    base_url = SPRING_BACKEND_URL.rstrip("/")
    async with httpx.AsyncClient(timeout=TOOL_TIMEOUT_SECONDS) as client:
        response = await client.get(f"{base_url}{path}", headers=_tool_headers())
        if response.status_code == 204:
            return None
        response.raise_for_status()
        return response.json()


async def get_instance(instance_id: str):
    return await _get(f"/api/agent/tools/instances/{instance_id}")


async def get_latest_metrics(instance_id: str):
    return await _get(f"/api/agent/tools/instances/{instance_id}/latest-metrics")


async def get_snapshot(instance_id: str, snapshot_id: int):
    return await _get(f"/api/agent/tools/instances/{instance_id}/snapshots/{snapshot_id}")


async def get_recent_snapshots(instance_id: str):
    return await _get(f"/api/agent/tools/instances/{instance_id}/snapshots/recent")


async def get_recent_anomalies(instance_id: str):
    return await _get(f"/api/agent/tools/instances/{instance_id}/anomalies/recent")
