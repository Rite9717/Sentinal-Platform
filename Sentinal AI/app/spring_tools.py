import httpx
from app.config import SPRING_BACKEND_URL

async def get_instance(instance_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SPRING_BACKEND_URL}/api/instances/{instance_id}"
        )
        response.raise_for_status()
        return response.json()

async def get_recent_snapshots(instance_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SPRING_BACKEND_URL}/api/metrics/snapshots/{instance_id}/recent"
        )
        response.raise_for_status()
        return response.json()

async def get_recent_anomalies(instance_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SPRING_BACKEND_URL}/api/metrics/anomalies/{instance_id}/recent"
        )
        response.raise_for_status()
        return response.json()


async def get_incidents(instance_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SPRING_BACKEND_URL}/api/incidents/{instance_id}/recent"
        )
        response.raise_for_status()
        return response.json()