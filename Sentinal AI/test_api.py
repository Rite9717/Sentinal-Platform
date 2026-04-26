#!/usr/bin/env python3
"""
Test script to call the Sentinel AI API directly
"""
import requests
import json

# Test payload matching your incident
payload = {
    "instance": {
        "instanceId": "i-039d676689fc848e8",
        "region": "us-east-1",
        "nickname": "IMS",
        "state": "UP",
        "suspectCount": 0,
        "quarantineCount": 2,
        "maxSuspectStrikes": 5,
        "maxQuarantineCycles": 2,
        "quarantineDurationMinutes": 5,
        "lastError": None,
        "stateChangedAt": 1776843901775
    },
    "incidentSnapshots": [
        {
            "id": 27,
            "incidentStartTime": "2026-04-22 13:13:36",
            "incidentEndTime": "2026-04-22 13:15:01",
            "resolution": "UP",
            "metricsTimeline": json.dumps([
                {
                    "state": "SUSPECT",
                    "capturedAt": "2026-04-22 13:13:36",
                    "cpuUsage": 0.0,
                    "memoryUsage": 0.0,
                    "diskUsage": 0.0,
                    "networkIn": 0.0,
                    "networkOut": 0.0,
                    "systemLoad": 0.0,
                    "note": "Health check failed"
                },
                {
                    "state": "SUSPECT",
                    "capturedAt": "2026-04-22 13:13:53",
                    "cpuUsage": 0.0,
                    "memoryUsage": 0.0,
                    "diskUsage": 0.0,
                    "networkIn": 0.0,
                    "networkOut": 0.0,
                    "systemLoad": 0.0,
                    "note": "Health check failed"
                },
                {
                    "state": "QUARANTINED",
                    "capturedAt": "2026-04-22 13:14:44",
                    "cpuUsage": 0.0,
                    "memoryUsage": 0.0,
                    "diskUsage": 0.0,
                    "networkIn": 0.0,
                    "networkOut": 0.0,
                    "systemLoad": 0.0,
                    "note": "Health check failed"
                },
                {
                    "state": "UP",
                    "capturedAt": "2026-04-22 13:15:01",
                    "cpuUsage": 0.0,
                    "memoryUsage": 0.0,
                    "diskUsage": 0.0,
                    "networkIn": 0.0,
                    "networkOut": 0.0,
                    "systemLoad": 0.0,
                    "note": "Recovered during quarantine"
                }
            ]),
            "aiContext": "Test incident for i-039d676689fc848e8"
        }
    ],
    "metricsSnapshots": []
}

print("=" * 70)
print("Testing Sentinel AI API")
print("=" * 70)
print(f"\nSending request to: http://localhost:8000/analyze")
print(f"Payload size: {len(json.dumps(payload))} bytes\n")

try:
    response = requests.post(
        "http://localhost:8000/analyze",
        json=payload,
        timeout=180
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}\n")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ SUCCESS!")
        print("\n" + "=" * 70)
        print("ANALYSIS RESULT:")
        print("=" * 70)
        print(f"\nInstance ID: {result['instanceId']}")
        print(f"Generated At: {result['generatedAt']}")
        print(f"\n--- TRIAGE ---\n{result['triage']}")
        print(f"\n--- ROOT CAUSE ---\n{result['rootCause']}")
        print(f"\n--- REMEDIATION ---\n{result['remediation']}")
        print("\n" + "=" * 70)
    else:
        print("❌ ERROR!")
        print(f"\nResponse Body:\n{response.text}")
        
except requests.exceptions.Timeout:
    print("❌ Request timed out after 180 seconds")
except requests.exceptions.ConnectionError:
    print("❌ Could not connect to http://localhost:8000")
    print("Make sure the Python service is running!")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
