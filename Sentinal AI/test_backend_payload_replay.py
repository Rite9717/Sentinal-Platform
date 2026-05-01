"""
Replay the same payload shape sent by Spring backend to Sentinal AI.

Usage:
  python3 test_backend_payload_replay.py \
    --instance-id i-039d676689fc848e8 \
    --snapshot-id 123 \
    --prompt "Analyse this selected lifecycle snapshot end to end."
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from typing import Any

import httpx


DEFAULT_PROMPT = (
    "Analyse this selected lifecycle snapshot end to end. Identify the first "
    "degraded signal, explain the state transitions, infer the most likely root "
    "cause, and give immediate, short-term, long-term, and Sentinal "
    "configuration remediation steps."
)

DEFAULT_ALLOWED_TOOLS = [
    "get_instance",
    "get_latest_metrics",
    "get_snapshot",
    "get_recent_snapshots",
    "get_recent_anomalies",
]


@dataclass
class BackendPayloadReplayTest:
    ai_base_url: str
    instance_id: str
    snapshot_id: int
    user_question: str
    allowed_tools: list[str]
    timeout_seconds: int = 260
    attempts: int = 1

    @property
    def endpoint(self) -> str:
        return self.ai_base_url.rstrip("/") + "/agent/analyze-instance"

    @property
    def payload(self) -> dict[str, Any]:
        # Exactly what backend sends from SentinelAiClient
        return {
            "instance_id": self.instance_id,
            "snapshot_id": self.snapshot_id,
            "user_question": self.user_question,
            "agent_context": {},
            "allowed_tools": self.allowed_tools,
        }

    def run(self) -> None:
        print(f"Target endpoint: {self.endpoint}")
        print(f"Timeout (sec): {self.timeout_seconds}")
        print(f"Attempts: {self.attempts}")
        print("Payload:")
        print(json.dumps(self.payload, indent=2))
        print("-" * 80)

        for attempt in range(1, self.attempts + 1):
            print(f"[Attempt {attempt}] Sending request...")
            started = time.perf_counter()
            try:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.post(self.endpoint, json=self.payload)
                elapsed = time.perf_counter() - started

                print(f"[Attempt {attempt}] HTTP {response.status_code} in {elapsed:.2f}s")
                print(f"[Attempt {attempt}] Response headers: {dict(response.headers)}")
                try:
                    data = response.json()
                    print(f"[Attempt {attempt}] JSON response:")
                    print(json.dumps(data, indent=2)[:6000])
                except Exception:
                    print(f"[Attempt {attempt}] Non-JSON response (first 6000 chars):")
                    print(response.text[:6000])
            except Exception as exc:
                elapsed = time.perf_counter() - started
                print(f"[Attempt {attempt}] FAILED in {elapsed:.2f}s: {type(exc).__name__}: {exc}")
            print("-" * 80)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Replay backend payload to Sentinal AI endpoint")
    parser.add_argument("--ai-url", default="http://localhost:8000", help="Sentinal AI base URL")
    parser.add_argument("--instance-id", required=True, help="EC2 instance id")
    parser.add_argument("--snapshot-id", required=True, type=int, help="Incident snapshot id")
    parser.add_argument("--prompt", default=DEFAULT_PROMPT, help="Prompt sent as user_question")
    parser.add_argument(
        "--allowed-tool",
        action="append",
        dest="allowed_tools",
        help="Allowed tool name. Can be provided multiple times. Defaults to the backend allowlist.",
    )
    parser.add_argument("--timeout", default=260, type=int, help="HTTP timeout in seconds")
    parser.add_argument("--attempts", default=1, type=int, help="How many times to replay")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    runner = BackendPayloadReplayTest(
        ai_base_url=args.ai_url,
        instance_id=args.instance_id,
        snapshot_id=args.snapshot_id,
        user_question=args.prompt,
        allowed_tools=args.allowed_tools or DEFAULT_ALLOWED_TOOLS,
        timeout_seconds=args.timeout,
        attempts=args.attempts,
    )
    runner.run()


if __name__ == "__main__":
    main()
