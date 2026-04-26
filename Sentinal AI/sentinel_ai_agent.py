# from __future__ import annotations

# import datetime
# import json
# import os
# import sys
# import textwrap
# from typing import Any, Optional, Iterator

# import requests
# import uvicorn
# from dotenv import load_dotenv
# from fastapi import FastAPI, HTTPException
# from fastapi.responses import JSONResponse, StreamingResponse
# from pydantic import BaseModel, Field

# load_dotenv()

# # ─────────────────────────────────────────────
# # Config
# # ─────────────────────────────────────────────
# NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
# NVIDIA_MODEL   = os.getenv("NVIDIA_MODEL", "google/gemma-4-31b-it")
# NVIDIA_URL     = "https://integrate.api.nvidia.com/v1/chat/completions"
# HOST           = os.getenv("HOST", "0.0.0.0")
# PORT           = int(os.getenv("PORT", 8000))

# app = FastAPI(
#     title="Sentinel AI Analysis Service",
#     version="3.0.0",
# )

# # ─────────────────────────────────────────────
# # Models (same as before)
# # ─────────────────────────────────────────────

# class InstanceDetails(BaseModel):
#     instanceId:               str
#     region:                   str
#     nickname:                 Optional[str]   = None
#     state:                    str
#     suspectCount:             int             = 0
#     quarantineCount:          int             = 0
#     maxSuspectStrikes:        int             = 3
#     maxQuarantineCycles:      int             = 3
#     quarantineDurationMinutes: int            = 5
#     lastError:                Optional[str]   = None
#     stateChangedAt:           Optional[int]   = None

# class MetricsInterval(BaseModel):
#     state:       Optional[str]   = None
#     capturedAt:  Optional[str]   = None
#     cpuUsage:    Optional[float] = None
#     memoryUsage: Optional[float] = None
#     diskUsage:   Optional[float] = None
#     networkIn:   Optional[float] = None
#     networkOut:  Optional[float] = None
#     systemLoad:  Optional[float] = None
#     note:        Optional[str]   = None

# class IncidentSnapshotRow(BaseModel):
#     id:                int
#     incidentStartTime: Optional[str] = None
#     incidentEndTime:   Optional[str] = None
#     resolution:        Optional[str] = None
#     metricsTimeline:   Optional[str] = None
#     aiContext:         Optional[str] = None
#     aiAnalysis:        Optional[str] = None

# class MetricsSnapshotRow(BaseModel):
#     id:            int
#     errorType:     Optional[str]   = None
#     errorMessage:  Optional[str]   = None
#     snapshotTime:  Optional[str]   = None
#     cpuUsage:      Optional[float] = None
#     memoryUsage:   Optional[float] = None
#     networkIn:     Optional[float] = None
#     networkOut:    Optional[float] = None
#     diskIops:      Optional[float] = None
#     instanceState: Optional[float] = None
#     aiContext:     Optional[str]   = None

# class AnalyzeRequest(BaseModel):
#     instance:          InstanceDetails
#     incidentSnapshots: list[IncidentSnapshotRow] = Field(default_factory=list)
#     metricsSnapshots:  list[MetricsSnapshotRow]  = Field(default_factory=list)

# class AnalyzeResponse(BaseModel):
#     instanceId:       str
#     generatedAt:      str
#     triage:           str
#     rootCause:        str
#     remediation:      str
#     combinedAnalysis: str

# # ─────────────────────────────────────────────
# # Payload builder (unchanged)
# # ─────────────────────────────────────────────
# _STATE_MAP = {1: "UP", 2: "SUSPECT", 3: "QUARANTINED", 4: "TERMINATED"}

# def build_cross_reference_payload(
#     instance:  InstanceDetails,
#     incidents: list[IncidentSnapshotRow],
#     metrics:   list[MetricsSnapshotRow],
# ) -> str:
#     lines: list[str] = []
#     lines.append("=" * 70)
#     lines.append("SENTINEL PLATFORM — INCIDENT DIAGNOSTIC PAYLOAD")
#     lines.append("=" * 70)

#     lines.append("\n── INSTANCE DETAILS ──")
#     lines.append(f"  Instance ID            : {instance.instanceId}")
#     lines.append(f"  Region                 : {instance.region}")
#     lines.append(f"  Current state          : {instance.state}")
#     lines.append(f"  Suspect strikes so far : {instance.suspectCount} / {instance.maxSuspectStrikes}")
#     lines.append(f"  Quarantine cycles      : {instance.quarantineCount} / {instance.maxQuarantineCycles}")
#     lines.append(f"  Last error             : {instance.lastError or 'none'}")

#     lines.append("\n── INCIDENT SNAPSHOTS ──")
#     for idx, inc in enumerate(incidents, 1):
#         lines.append(f"\n  Incident #{idx} (id={inc.id})")
#         lines.append(f"    Started    : {inc.incidentStartTime or 'unknown'}")
#         lines.append(f"    Ended      : {inc.incidentEndTime or 'OPEN'}")
#         lines.append(f"    Resolution : {inc.resolution or 'OPEN'}")
#         timeline = []
#         if inc.metricsTimeline:
#             try:
#                 timeline = json.loads(inc.metricsTimeline)
#             except Exception:
#                 pass
#         for i, interval in enumerate(timeline, 1):
#             lines.append(
#                 f"      [{i}] {interval.get('capturedAt','?')} | "
#                 f"state={interval.get('state','?')} | "
#                 f"note={interval.get('note','—')} | "
#                 f"cpu={interval.get('cpuUsage','?')}% "
#                 f"mem={interval.get('memoryUsage','?')}% "
#                 f"load={interval.get('systemLoad','?')}"
#             )
#         if inc.aiContext:
#             lines.append(f"    AI Context: {inc.aiContext}")

#     lines.append("\n── METRICS SNAPSHOTS ──")
#     for idx, snap in enumerate(metrics, 1):
#         state_label = _STATE_MAP.get(int(snap.instanceState or 0), str(snap.instanceState))
#         lines.append(f"\n  Snapshot #{idx} (id={snap.id})")
#         lines.append(f"    Captured   : {snap.snapshotTime}")
#         lines.append(f"    Error type : {snap.errorType or '—'}")
#         lines.append(f"    CPU        : {snap.cpuUsage}%  Memory: {snap.memoryUsage}%")
#         lines.append(f"    Network    : in={snap.networkIn} out={snap.networkOut}")
#         lines.append(f"    State      : {state_label}")
#         if snap.aiContext:
#             lines.append(f"    AI Context : {snap.aiContext}")

#     return "\n".join(lines)

# # ─────────────────────────────────────────────
# # Prompts (unchanged)
# # ─────────────────────────────────────────────
# SYSTEM_PROMPT = textwrap.dedent("""
#     You are SentinelAI, an expert site-reliability engineer embedded in the
#     Sentinel monitoring platform. Produce precise, actionable incident analysis.
#     Always name the exact instance, metric, and timestamp from the data.
# """).strip()

# FULL_ANALYSIS_PROMPT = textwrap.dedent("""
#     Analyse the following incident payload in three clearly labelled steps:

#     --- STEP 1: TRIAGE ---
#     Which metric degraded first, at what timestamp, and what was its value?

#     --- STEP 2: ROOT CAUSE ---
#     What is the most likely root cause? How did metrics evolve across each
#     state transition (UP → SUSPECT → QUARANTINED)? Cite exact timestamps.

#     --- STEP 3: REMEDIATION ---
#     Four sections:
#       IMMEDIATE ACTION   — stabilise now
#       SHORT-TERM FIX     — stop recurrence
#       LONG-TERM FIX      — architectural improvements
#       SENTINEL CONFIG    — recommend exact maxSuspectStrikes /
#                            quarantineDurationMinutes values with justification

#     PAYLOAD:
#     {payload}
# """).strip()

# # ─────────────────────────────────────────────
# # NVIDIA call — non-streaming (for /analyze)
# # ─────────────────────────────────────────────
# def call_nvidia(messages: list[dict]) -> str:
#     if not NVIDIA_API_KEY:
#         raise RuntimeError("NVIDIA_API_KEY is not configured.")

#     response = requests.post(
#         NVIDIA_URL,
#         headers={
#             "Authorization": f"Bearer {NVIDIA_API_KEY}",
#             "Accept": "application/json",
#         },
#         json={
#             "model": NVIDIA_MODEL,
#             "messages": messages,
#             "max_tokens": 16384,
#             "temperature": 0.7,
#             "top_p": 0.95,
#             "stream": False,
#         },
#         timeout=300,
#     )
#     response.raise_for_status()
#     return response.json()["choices"][0]["message"]["content"].strip()


# # ─────────────────────────────────────────────
# # NVIDIA call — streaming (for /analyze/stream)
# # ─────────────────────────────────────────────
# def call_nvidia_stream(messages: list[dict]) -> Iterator[str]:
#     if not NVIDIA_API_KEY:
#         raise RuntimeError("NVIDIA_API_KEY is not configured.")

#     with requests.post(
#         NVIDIA_URL,
#         headers={
#             "Authorization": f"Bearer {NVIDIA_API_KEY}",
#             "Accept": "text/event-stream",
#         },
#         json={
#             "model": NVIDIA_MODEL,
#             "messages": messages,
#             "max_tokens": 16384,
#             "temperature": 0.7,
#             "top_p": 0.95,
#             "stream": True,
#             "chat_template_kwargs": {"enable_thinking": True},
#         },
#         stream=True,
#         timeout=300,
#     ) as resp:
#         resp.raise_for_status()
#         for line in resp.iter_lines():
#             if line:
#                 decoded = line.decode("utf-8")
#                 if decoded.startswith("data: "):
#                     data = decoded[6:]
#                     if data == "[DONE]":
#                         return
#                     try:
#                         chunk = json.loads(data)
#                         token = chunk["choices"][0]["delta"].get("content", "")
#                         if token:
#                             yield token
#                     except Exception:
#                         continue


# # ─────────────────────────────────────────────
# # Routes
# # ─────────────────────────────────────────────

# @app.get("/health")
# def health_check():
#     return {"status": "ok", "model": NVIDIA_MODEL}


# @app.post("/analyze", response_model=AnalyzeResponse)
# def analyze(request: AnalyzeRequest):
#     """Blocking analysis — returns full result when AI finishes."""
#     payload = build_cross_reference_payload(
#         request.instance, request.incidentSnapshots, request.metricsSnapshots
#     )
#     messages = [
#         {"role": "system", "content": SYSTEM_PROMPT},
#         {"role": "user",   "content": FULL_ANALYSIS_PROMPT.format(payload=payload)},
#     ]
#     try:
#         combined = call_nvidia(messages)
#     except RuntimeError as e:
#         raise HTTPException(status_code=503, detail=str(e))
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")

#     generated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

#     # Split steps out of combined for structured response
#     triage      = _extract_step(combined, "STEP 1: TRIAGE",      "STEP 2")
#     root_cause  = _extract_step(combined, "STEP 2: ROOT CAUSE",  "STEP 3")
#     remediation = _extract_step(combined, "STEP 3: REMEDIATION", None)

#     return AnalyzeResponse(
#         instanceId=request.instance.instanceId,
#         generatedAt=generated_at,
#         triage=triage,
#         rootCause=root_cause,
#         remediation=remediation,
#         combinedAnalysis=combined,
#     )


# @app.post("/analyze/stream")
# def analyze_stream(request: AnalyzeRequest):
#     """
#     Streaming analysis — tokens flow directly from NVIDIA to the client
#     as Server-Sent Events. Java backend calls this and forwards the
#     SSE stream to the frontend.
#     """
#     payload = build_cross_reference_payload(
#         request.instance, request.incidentSnapshots, request.metricsSnapshots
#     )
#     messages = [
#         {"role": "system", "content": SYSTEM_PROMPT},
#         {"role": "user",   "content": FULL_ANALYSIS_PROMPT.format(payload=payload)},
#     ]

#     def event_generator():
#         full_text = []
#         try:
#             for token in call_nvidia_stream(messages):
#                 full_text.append(token)
#                 # Forward each token as an SSE event
#                 yield f"data: {json.dumps({'token': token})}\n\n"

#             # Send done event with metadata
#             generated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
#             combined     = "".join(full_text)
#             yield f"data: {json.dumps({'done': True, 'generatedAt': generated_at, 'combinedAnalysis': combined})}\n\n"

#         except Exception as e:
#             yield f"data: {json.dumps({'error': str(e)})}\n\n"

#     return StreamingResponse(event_generator(), media_type="text/event-stream")


# # ─────────────────────────────────────────────
# # Helper
# # ─────────────────────────────────────────────
# def _extract_step(text: str, start_marker: str, end_marker: Optional[str]) -> str:
#     try:
#         start = text.index(start_marker) + len(start_marker)
#         end   = text.index(end_marker) if end_marker and end_marker in text else len(text)
#         return text[start:end].strip()
#     except ValueError:
#         return text.strip()


# if __name__ == "__main__":
#     if not NVIDIA_API_KEY:
#         print("ERROR: NVIDIA_API_KEY is not set.")
#         sys.exit(1)
#     print(f"Sentinel AI v3.0 | Model: {NVIDIA_MODEL} | http://{HOST}:{PORT}")
#     uvicorn.run(app, host=HOST, port=PORT)

# """
# sentinel_ai_agent.py
# ─────────────────────────────────────────────────────────────────
# Sentinel AI Analysis Service  —  FastAPI Edition
# ─────────────────────────────────────────────────────────────────
# WHAT IT DOES
#   Exposes a single REST endpoint:

#       POST /analyze

#   The Sentinel Java backend POSTs a JSON payload containing:
#     • instance metadata
#     • incident_snapshot rows   (full timeline + aiContext)
#     • metrics_snapshot rows    (per-event snapshots + aiContext)

#   The service runs a 3-step agentic loop using Google Gemini:
#       Step 1 – Triage      : which metric degraded first & when
#       Step 2 – Root-cause  : why it happened
#       Step 3 – Remediation : what to do about it

#   Returns a structured JSON response with all three steps plus
#   a combined analysis string ready to be written to aiAnalysis.

# SETUP
#   pip install fastapi uvicorn google-generativeai python-dotenv

#   .env (or environment variables):
#       GEMINI_API_KEY=<your-free-key>
#       GEMINI_MODEL=gemini-1.5-flash        (optional)
#       HOST=0.0.0.0                         (optional)
#       PORT=8000                            (optional)

# RUN
#   python sentinel_ai_agent.py
#   — or —
#   uvicorn sentinel_ai_agent:app --host 0.0.0.0 --port 8000
# """

# from __future__ import annotations

# import datetime
# import json
# import os
# import sys
# import textwrap
# from typing import Any, Optional

# import google.generativeai as genai
# import uvicorn
# from dotenv import load_dotenv
# from fastapi import FastAPI, HTTPException
# from fastapi.responses import JSONResponse
# from pydantic import BaseModel, Field

# load_dotenv()

# # ─────────────────────────────────────────────
# # Config
# # ─────────────────────────────────────────────
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-pro")  # Changed to gemini-pro
# HOST           = os.getenv("HOST", "0.0.0.0")
# PORT           = int(os.getenv("PORT", 8000))

# # ─────────────────────────────────────────────
# # FastAPI app
# # ─────────────────────────────────────────────
# app = FastAPI(
#     title="Sentinel AI Analysis Service",
#     description="3-step agentic incident analysis for the Sentinel monitoring platform",
#     version="2.0.0",
# )

# # ─────────────────────────────────────────────
# # Request / Response models
# # ─────────────────────────────────────────────

# class InstanceDetails(BaseModel):
#     instanceId:              str
#     region:                  str
#     nickname:                Optional[str]   = None
#     state:                   str
#     suspectCount:            int             = 0
#     quarantineCount:         int             = 0
#     maxSuspectStrikes:       int             = 3
#     maxQuarantineCycles:     int             = 3
#     quarantineDurationMinutes: int           = 5
#     lastError:               Optional[str]   = None
#     stateChangedAt:          Optional[int]   = None   # epoch millis


# class MetricsInterval(BaseModel):
#     state:       Optional[str]   = None
#     capturedAt:  Optional[str]   = None
#     cpuUsage:    Optional[float] = None
#     memoryUsage: Optional[float] = None
#     diskUsage:   Optional[float] = None
#     networkIn:   Optional[float] = None
#     networkOut:  Optional[float] = None
#     systemLoad:  Optional[float] = None
#     note:        Optional[str]   = None


# class IncidentSnapshotRow(BaseModel):
#     id:                int
#     incidentStartTime: Optional[str] = None
#     incidentEndTime:   Optional[str] = None
#     resolution:        Optional[str] = None
#     metricsTimeline:   Optional[str] = None   # JSON string
#     aiContext:         Optional[str] = None
#     aiAnalysis:        Optional[str] = None


# class MetricsSnapshotRow(BaseModel):
#     id:            int
#     errorType:     Optional[str]   = None
#     errorMessage:  Optional[str]   = None
#     snapshotTime:  Optional[str]   = None
#     cpuUsage:      Optional[float] = None
#     memoryUsage:   Optional[float] = None
#     networkIn:     Optional[float] = None
#     networkOut:    Optional[float] = None
#     diskIops:      Optional[float] = None
#     instanceState: Optional[float] = None
#     aiContext:     Optional[str]   = None


# class AnalyzeRequest(BaseModel):
#     instance:          InstanceDetails
#     incidentSnapshots: list[IncidentSnapshotRow] = Field(default_factory=list)
#     metricsSnapshots:  list[MetricsSnapshotRow]  = Field(default_factory=list)


# class AnalyzeResponse(BaseModel):
#     instanceId:      str
#     generatedAt:     str
#     triage:          str
#     rootCause:       str
#     remediation:     str
#     combinedAnalysis: str


# # ─────────────────────────────────────────────
# # Payload builder  (same logic as DB version)
# # ─────────────────────────────────────────────

# _STATE_MAP = {1: "UP", 2: "SUSPECT", 3: "QUARANTINED", 4: "TERMINATED"}


# def build_cross_reference_payload(
#     instance:  InstanceDetails,
#     incidents: list[IncidentSnapshotRow],
#     metrics:   list[MetricsSnapshotRow],
# ) -> str:
#     lines: list[str] = []
#     lines.append("=" * 70)
#     lines.append("SENTINEL PLATFORM — INCIDENT DIAGNOSTIC PAYLOAD")
#     lines.append("=" * 70)
#     lines.append("")

#     # ── Instance ──────────────────────────────────────────────────────
#     lines.append("── INSTANCE DETAILS ──────────────────────────────────────────")
#     lines.append(f"  Instance ID            : {instance.instanceId}")
#     lines.append(f"  Nickname               : {instance.nickname or '—'}")
#     lines.append(f"  Region                 : {instance.region}")
#     lines.append(f"  Current state          : {instance.state}")
#     lines.append(f"  Suspect strikes so far : {instance.suspectCount} / {instance.maxSuspectStrikes}")
#     lines.append(f"  Quarantine cycles      : {instance.quarantineCount} / {instance.maxQuarantineCycles}")
#     lines.append(f"  Quarantine duration    : {instance.quarantineDurationMinutes} min")
#     lines.append(f"  Last error recorded    : {instance.lastError or 'none'}")
#     if instance.stateChangedAt:
#         ts_sec = instance.stateChangedAt / 1000 if instance.stateChangedAt > 1e10 else instance.stateChangedAt
#         lines.append(f"  State changed at       : {datetime.datetime.fromtimestamp(ts_sec)}")
#     lines.append("")

#     # ── Incident snapshots ────────────────────────────────────────────
#     lines.append("── INCIDENT SNAPSHOTS ────────────────────────────────────────")
#     if not incidents:
#         lines.append("  No incident records found.")
#     for idx, inc in enumerate(incidents, 1):
#         lines.append(f"\n  Incident #{idx}  (db id={inc.id})")
#         lines.append(f"    Started    : {inc.incidentStartTime or 'unknown'}")
#         lines.append(f"    Ended      : {inc.incidentEndTime or 'OPEN'}")
#         lines.append(f"    Resolution : {inc.resolution or 'OPEN / unresolved'}")

#         timeline: list[dict[str, Any]] = []
#         if inc.metricsTimeline:
#             try:
#                 timeline = json.loads(inc.metricsTimeline)
#             except Exception:
#                 pass

#         if timeline:
#             lines.append(f"    Timeline intervals : {len(timeline)}")
#             for i, interval in enumerate(timeline, 1):
#                 captured = interval.get("capturedAt") or interval.get("captured_at") or "?"
#                 state    = interval.get("state", "?")
#                 note     = interval.get("note") or "—"
#                 cpu      = interval.get("cpuUsage",    interval.get("cpu_usage",    "?"))
#                 mem      = interval.get("memoryUsage", interval.get("memory_usage", "?"))
#                 disk     = interval.get("diskUsage",   interval.get("disk_usage",   "?"))
#                 net_in   = interval.get("networkIn",   interval.get("network_in",   "?"))
#                 net_out  = interval.get("networkOut",  interval.get("network_out",  "?"))
#                 load     = interval.get("systemLoad",  interval.get("system_load",  "?"))
#                 lines.append(f"      [{i}] {captured} | state={state} | note={note}")
#                 lines.append(
#                     f"           cpu={cpu}%  mem={mem}%  disk={disk}%"
#                     f"  netIn={net_in}  netOut={net_out}  load={load}"
#                 )
#         else:
#             lines.append("    Timeline : (empty)")

#         if inc.aiContext:
#             lines.append("\n    AI Context (built by Java backend):")
#             for ln in inc.aiContext.splitlines():
#                 lines.append(f"      {ln}")
#     lines.append("")

#     # ── Metrics snapshots ─────────────────────────────────────────────
#     lines.append("── METRICS SNAPSHOTS ─────────────────────────────────────────")
#     if not metrics:
#         lines.append("  No metrics snapshot records found.")
#     for idx, snap in enumerate(metrics, 1):
#         state_label = _STATE_MAP.get(int(snap.instanceState or 0), str(snap.instanceState))
#         lines.append(f"\n  Snapshot #{idx}  (db id={snap.id})")
#         lines.append(f"    Captured at    : {snap.snapshotTime or 'unknown'}")
#         lines.append(f"    Error type     : {snap.errorType or '—'}")
#         lines.append(f"    Error message  : {snap.errorMessage or '—'}")
#         lines.append(f"    CPU usage      : {snap.cpuUsage}%")
#         lines.append(f"    Memory usage   : {snap.memoryUsage}%")
#         lines.append(f"    Network in     : {snap.networkIn} B/s")
#         lines.append(f"    Network out    : {snap.networkOut} B/s")
#         lines.append(f"    Disk IOPS      : {snap.diskIops}")
#         lines.append(f"    Instance state : {state_label}")
#         if snap.aiContext:
#             lines.append("    AI Context (built by Java backend):")
#             for ln in snap.aiContext.splitlines():
#                 lines.append(f"      {ln}")
#     lines.append("")

#     # ── Cross-reference summary ───────────────────────────────────────
#     lines.append("── CROSS-REFERENCE SUMMARY ───────────────────────────────────")
#     lines.append(f"  Total incident records   : {len(incidents)}")
#     lines.append(f"  Total metrics snapshots  : {len(metrics)}")

#     distinct_errors = list({s.errorType for s in metrics if s.errorType})
#     lines.append(f"  Distinct error types     : {', '.join(distinct_errors) or 'none'}")

#     cpu_vals = [s.cpuUsage    for s in metrics if s.cpuUsage    is not None]
#     mem_vals = [s.memoryUsage for s in metrics if s.memoryUsage is not None]
#     if cpu_vals:
#         lines.append(f"  Peak CPU (metrics snaps) : {max(cpu_vals):.2f}%")
#     if mem_vals:
#         lines.append(f"  Peak Memory (metrics)    : {max(mem_vals):.2f}%")
#     lines.append("")

#     return "\n".join(lines)


# # ─────────────────────────────────────────────
# # Prompt templates
# # ─────────────────────────────────────────────
# SYSTEM_PROMPT = textwrap.dedent("""
#     You are SentinelAI, an expert site-reliability engineer and cloud infrastructure
#     diagnostician embedded in the Sentinel monitoring platform.

#     You will receive a structured diagnostic payload containing:
#     - Instance metadata and quarantine context
#     - A full incident timeline (from incident_snapshot table)
#     - Per-event metrics snapshots (from metrics_snapshot table)

#     Your job is to produce a precise, actionable incident analysis.
#     Always be specific: name the exact instance, the exact metric, the exact timestamp.
#     Avoid generic advice — every suggestion must be grounded in the data provided.
# """).strip()

# _TRIAGE_PROMPT = textwrap.dedent("""
#     STEP 1 — TRIAGE

#     Based on the diagnostic payload below, answer ONLY:
#     1. Which specific metric degraded FIRST? (CPU / Memory / Disk / Network / Load / EC2 health check)
#     2. At what exact timestamp did that degradation begin?
#     3. What was the metric value at that moment?
#     4. Which instance ID is affected?

#     Be concise. One paragraph maximum.

#     PAYLOAD:
#     {payload}
# """).strip()

# _ROOT_CAUSE_PROMPT = textwrap.dedent("""
#     STEP 2 — ROOT CAUSE ANALYSIS

#     You have already identified the first degrading metric.
#     Triage summary:
#     {triage}

#     Now, using the full payload, determine:
#     1. The most likely ROOT CAUSE of this incident (process crash, memory leak,
#        disk exhaustion, network saturation, runaway job, AWS infra fault, etc.)
#     2. How did the metrics evolve across each state transition
#        (UP → SUSPECT → QUARANTINED)?
#     3. Any correlated signals between incident_snapshot intervals and
#        metrics_snapshot error types that support your conclusion.

#     Be specific. Reference exact timestamps and values from the data.

#     PAYLOAD:
#     {payload}
# """).strip()

# _REMEDIATION_PROMPT = textwrap.dedent("""
#     STEP 3 — REMEDIATION PLAN

#     Root cause identified:
#     {root_cause}

#     Now provide:
#     1. IMMEDIATE ACTION  — what to do right now to stabilise the instance
#     2. SHORT-TERM FIX    — what to change in config / code / infra to stop recurrence
#     3. LONG-TERM FIX     — architectural / process improvements to prevent this class of incident
#     4. SENTINEL CONFIG   — should maxSuspectStrikes or quarantineDurationMinutes be adjusted
#        for this instance? If yes, recommend exact values with justification.

#     Format your answer as four clearly labelled sections.
# """).strip()


# # ─────────────────────────────────────────────
# # Agentic loop
# # ─────────────────────────────────────────────

# def _call_gemini(model, prompt: str) -> str:
#     response = model.generate_content(prompt)
#     return response.text.strip()


# def run_agentic_loop(
#     instance:  InstanceDetails,
#     incidents: list[IncidentSnapshotRow],
#     metrics:   list[MetricsSnapshotRow],
# ) -> tuple[str, str, str]:
#     """
#     Runs the 3-step agentic reasoning loop.
#     Returns (triage, root_cause, remediation).
#     """
#     if not GEMINI_API_KEY:
#         raise RuntimeError("GEMINI_API_KEY is not configured on the server.")

#     genai.configure(api_key=GEMINI_API_KEY)
#     model = genai.GenerativeModel(
#         GEMINI_MODEL,
#         system_instruction=SYSTEM_PROMPT,
#     )

#     payload = build_cross_reference_payload(instance, incidents, metrics)

#     triage     = _call_gemini(model, _TRIAGE_PROMPT.format(payload=payload))
#     root_cause = _call_gemini(model, _ROOT_CAUSE_PROMPT.format(triage=triage, payload=payload))
#     remediation = _call_gemini(model, _REMEDIATION_PROMPT.format(root_cause=root_cause))

#     return triage, root_cause, remediation


# # ─────────────────────────────────────────────
# # Routes
# # ─────────────────────────────────────────────

# @app.get("/health")
# def health_check():
#     return {"status": "ok", "model": GEMINI_MODEL}


# @app.post("/analyze", response_model=AnalyzeResponse)
# def analyze(request: AnalyzeRequest):
#     """
#     Accepts a full incident payload from the Sentinel Java backend
#     and returns a structured 3-step AI analysis.

#     The Java backend should POST this after onIncidentClose() or
#     whenever a QUARANTINED instance needs diagnosis.
#     """
#     instance  = request.instance
#     incidents = request.incidentSnapshots
#     metrics   = request.metricsSnapshots

#     if not incidents and not metrics:
#         raise HTTPException(
#             status_code=422,
#             detail="At least one incidentSnapshot or metricsSnapshot must be provided.",
#         )

#     try:
#         triage, root_cause, remediation = run_agentic_loop(instance, incidents, metrics)
#     except RuntimeError as e:
#         raise HTTPException(status_code=503, detail=str(e))
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")

#     generated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

#     combined = "\n\n".join([
#         "=== SENTINEL AI ANALYSIS ===",
#         f"Generated at : {generated_at}",
#         f"Instance ID  : {instance.instanceId}",
#         "",
#         "--- STEP 1: TRIAGE ---",
#         triage,
#         "",
#         "--- STEP 2: ROOT CAUSE ---",
#         root_cause,
#         "",
#         "--- STEP 3: REMEDIATION ---",
#         remediation,
#     ])

#     return AnalyzeResponse(
#         instanceId=instance.instanceId,
#         generatedAt=generated_at,
#         triage=triage,
#         rootCause=root_cause,
#         remediation=remediation,
#         combinedAnalysis=combined,
#     )


# # ─────────────────────────────────────────────
# # Entry point
# # ─────────────────────────────────────────────

# if __name__ == "__main__":
#     if not GEMINI_API_KEY:
#         print("ERROR: GEMINI_API_KEY is not set.")
#         print("Get a free key at https://aistudio.google.com/app/apikey")
#         sys.exit(1)

#     print("──────────────────────────────────────────")
#     print("  Sentinel AI Analysis Service  v2.0")
#     print(f"  Model  : {GEMINI_MODEL}")
#     print(f"  Listen : http://{HOST}:{PORT}")
#     print(f"  Docs   : http://{HOST}:{PORT}/docs")
#     print("──────────────────────────────────────────")

#     uvicorn.run(app, host=HOST, port=PORT)

"""
sentinel_ai_agent.py
─────────────────────────────────────────────────────────────────
Sentinel AI Analysis Service  —  FastAPI + SambaNova Edition
─────────────────────────────────────────────────────────────────
SETUP
  pip install fastapi uvicorn openai python-dotenv

  .env:
      SAMBANOVA_API_KEY=xxxxxxxxxxxx
      SAMBANOVA_MODEL=DeepSeek-V3.1-cb
      HOST=0.0.0.0
      PORT=8000

RUN
  python sentinel_ai_agent.py
"""

from __future__ import annotations

import datetime
import json
import os
import sys
import textwrap
from typing import Any, Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel, Field

load_dotenv()

# ─────────────────────────────────────────────
# Config - SambaNova first, with legacy Groq/OpenRouter fallback
# ─────────────────────────────────────────────
SAMBANOVA_API_KEY = os.getenv("SAMBANOVA_API_KEY", "")
SAMBANOVA_MODEL   = os.getenv("SAMBANOVA_MODEL", "DeepSeek-V3.1-cb")
GROQ_API_KEY       = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL         = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-r1:free")
HOST               = os.getenv("HOST", "0.0.0.0")
PORT               = int(os.getenv("PORT", 8000))

if SAMBANOVA_API_KEY:
    PROVIDER = "SambaNova"
    API_KEY = SAMBANOVA_API_KEY
    MODEL = SAMBANOVA_MODEL
    BASE_URL = "https://api.sambanova.ai/v1"
elif GROQ_API_KEY:
    PROVIDER = "Groq"
    API_KEY = GROQ_API_KEY
    MODEL = GROQ_MODEL
    BASE_URL = "https://api.groq.com/openai/v1"
else:
    PROVIDER = "OpenRouter"
    API_KEY = OPENROUTER_API_KEY
    MODEL = OPENROUTER_MODEL
    BASE_URL = "https://openrouter.ai/api/v1"

MAX_OUTPUT_TOKENS = int(os.getenv("SENTINEL_AI_MAX_OUTPUT_TOKENS", "1800"))

# ─────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────
app = FastAPI(
    title="Sentinel AI Analysis Service",
    description="Incident analysis for the Sentinel monitoring platform",
    version="4.0.0",
)

# ─────────────────────────────────────────────
# Request / Response models
# ─────────────────────────────────────────────

class InstanceDetails(BaseModel):
    instanceId:               str
    region:                   str
    nickname:                 Optional[str] = None
    state:                    str
    suspectCount:             int           = 0
    quarantineCount:          int           = 0
    maxSuspectStrikes:        int           = 3
    maxQuarantineCycles:      int           = 3
    quarantineDurationMinutes: int          = 5
    lastError:                Optional[str] = None
    stateChangedAt:           Optional[int] = None


class IncidentSnapshotRow(BaseModel):
    id:                int
    incidentStartTime: Optional[str] = None
    incidentEndTime:   Optional[str] = None
    resolution:        Optional[str] = None
    metricsTimeline:   Optional[str] = None
    aiContext:         Optional[str] = None
    aiAnalysis:        Optional[str] = None


class MetricsSnapshotRow(BaseModel):
    id:            int
    errorType:     Optional[str]   = None
    errorMessage:  Optional[str]   = None
    snapshotTime:  Optional[str]   = None
    cpuUsage:      Optional[float] = None
    memoryUsage:   Optional[float] = None
    networkIn:     Optional[float] = None
    networkOut:    Optional[float] = None
    diskIops:      Optional[float] = None
    instanceState: Optional[float] = None
    aiContext:     Optional[str]   = None


class AnalyzeRequest(BaseModel):
    instance:          InstanceDetails
    incidentSnapshots: list[IncidentSnapshotRow] = Field(default_factory=list)
    metricsSnapshots:  list[MetricsSnapshotRow]  = Field(default_factory=list)
    analysisTask:      Optional[str]              = None


class AnalyzeResponse(BaseModel):
    instanceId:       str
    generatedAt:      str
    triage:           str
    rootCause:        str
    remediation:      str
    combinedAnalysis: str


# ─────────────────────────────────────────────
# Payload builder
# ─────────────────────────────────────────────
_STATE_MAP = {1: "UP", 2: "SUSPECT", 3: "QUARANTINED", 4: "TERMINATED"}


def build_cross_reference_payload(
    instance:  InstanceDetails,
    incidents: list[IncidentSnapshotRow],
    metrics:   list[MetricsSnapshotRow],
) -> str:
    lines: list[str] = []
    lines.append("=" * 70)
    lines.append("SENTINEL PLATFORM — INCIDENT DIAGNOSTIC PAYLOAD")
    lines.append("=" * 70)
    lines.append("")

    lines.append("── INSTANCE DETAILS ──────────────────────────────────────────")
    lines.append(f"  Instance ID            : {instance.instanceId}")
    lines.append(f"  Nickname               : {instance.nickname or '—'}")
    lines.append(f"  Region                 : {instance.region}")
    lines.append(f"  Current state          : {instance.state}")
    lines.append(f"  Suspect strikes so far : {instance.suspectCount} / {instance.maxSuspectStrikes}")
    lines.append(f"  Quarantine cycles      : {instance.quarantineCount} / {instance.maxQuarantineCycles}")
    lines.append(f"  Quarantine duration    : {instance.quarantineDurationMinutes} min")
    lines.append(f"  Last error recorded    : {instance.lastError or 'none'}")
    if instance.stateChangedAt:
        ts_sec = instance.stateChangedAt / 1000 if instance.stateChangedAt > 1e10 else instance.stateChangedAt
        lines.append(f"  State changed at       : {datetime.datetime.fromtimestamp(ts_sec)}")
    lines.append("")

    lines.append("── INCIDENT SNAPSHOTS ────────────────────────────────────────")
    if not incidents:
        lines.append("  No incident records found.")
    for idx, inc in enumerate(incidents, 1):
        lines.append(f"\n  Incident #{idx}  (db id={inc.id})")
        lines.append(f"    Started    : {inc.incidentStartTime or 'unknown'}")
        lines.append(f"    Ended      : {inc.incidentEndTime or 'OPEN'}")
        lines.append(f"    Resolution : {inc.resolution or 'OPEN / unresolved'}")

        timeline: list[dict[str, Any]] = []
        if inc.metricsTimeline:
            try:
                timeline = json.loads(inc.metricsTimeline)
            except Exception:
                pass

        if timeline:
            lines.append(f"    Timeline intervals : {len(timeline)}")
            for i, interval in enumerate(timeline, 1):
                captured = interval.get("capturedAt") or interval.get("captured_at") or "?"
                state    = interval.get("state", "?")
                note     = interval.get("note") or "—"
                cpu      = interval.get("cpuUsage",    interval.get("cpu_usage",    "?"))
                mem      = interval.get("memoryUsage", interval.get("memory_usage", "?"))
                disk     = interval.get("diskUsage",   interval.get("disk_usage",   "?"))
                net_in   = interval.get("networkIn",   interval.get("network_in",   "?"))
                net_out  = interval.get("networkOut",  interval.get("network_out",  "?"))
                load     = interval.get("systemLoad",  interval.get("system_load",  "?"))
                lines.append(f"      [{i}] {captured} | state={state} | note={note}")
                lines.append(
                    f"           cpu={cpu}%  mem={mem}%  disk={disk}%"
                    f"  netIn={net_in}  netOut={net_out}  load={load}"
                )
        else:
            lines.append("    Timeline : (empty)")

        if inc.aiContext:
            lines.append("\n    AI Context (built by Java backend):")
            for ln in inc.aiContext.splitlines():
                lines.append(f"      {ln}")
    lines.append("")

    lines.append("── METRICS SNAPSHOTS ─────────────────────────────────────────")
    if not metrics:
        lines.append("  No metrics snapshot records found.")
    for idx, snap in enumerate(metrics, 1):
        state_label = _STATE_MAP.get(int(snap.instanceState or 0), str(snap.instanceState))
        lines.append(f"\n  Snapshot #{idx}  (db id={snap.id})")
        lines.append(f"    Captured at    : {snap.snapshotTime or 'unknown'}")
        lines.append(f"    Error type     : {snap.errorType or '—'}")
        lines.append(f"    Error message  : {snap.errorMessage or '—'}")
        lines.append(f"    CPU usage      : {snap.cpuUsage}%")
        lines.append(f"    Memory usage   : {snap.memoryUsage}%")
        lines.append(f"    Network in     : {snap.networkIn} B/s")
        lines.append(f"    Network out    : {snap.networkOut} B/s")
        lines.append(f"    Disk IOPS      : {snap.diskIops}")
        lines.append(f"    Instance state : {state_label}")
        if snap.aiContext:
            lines.append("    AI Context (built by Java backend):")
            for ln in snap.aiContext.splitlines():
                lines.append(f"      {ln}")
    lines.append("")

    lines.append("── CROSS-REFERENCE SUMMARY ───────────────────────────────────")
    lines.append(f"  Total incident records   : {len(incidents)}")
    lines.append(f"  Total metrics snapshots  : {len(metrics)}")
    distinct_errors = list({s.errorType for s in metrics if s.errorType})
    lines.append(f"  Distinct error types     : {', '.join(distinct_errors) or 'none'}")
    cpu_vals = [s.cpuUsage    for s in metrics if s.cpuUsage    is not None]
    mem_vals = [s.memoryUsage for s in metrics if s.memoryUsage is not None]
    if cpu_vals:
        lines.append(f"  Peak CPU (metrics snaps) : {max(cpu_vals):.2f}%")
    if mem_vals:
        lines.append(f"  Peak Memory (metrics)    : {max(mem_vals):.2f}%")
    lines.append("")

    return "\n".join(lines)


# ─────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────
SYSTEM_PROMPT = textwrap.dedent("""
    You are SentinelAI, an expert site-reliability engineer and cloud infrastructure
    diagnostician embedded in the Sentinel monitoring platform.

    You will receive a structured diagnostic payload containing:
    - Instance metadata and quarantine context
    - One lifecycle incident snapshot from incident_snapshot
    - The full metrics timeline embedded in incident_snapshot.metricsTimeline
    - Optional legacy metrics_snapshot rows, if the backend sends any

    Your job is to produce a precise, actionable incident analysis for that one
    selected lifecycle snapshot.
    Always be specific: name the exact instance, the exact metric, the exact timestamp.
    Avoid generic advice — every suggestion must be grounded in the data provided.
""").strip()


DEFAULT_ANALYSIS_TASK = """
Analyse the selected lifecycle incident snapshot. Identify what changed first,
why the instance moved through its states, the most likely root cause, and the
actions the operator should take next.
""".strip()


def build_prompt(payload: str, analysis_task: Optional[str] = None) -> str:
    task = (analysis_task or DEFAULT_ANALYSIS_TASK).strip()
    return f"""
USER TASK:
{task}

Analyse the following incident payload in exactly three sections.
Use these exact headers:

--- STEP 1: TRIAGE ---
Which metric degraded first, at what exact timestamp, and what was its value?
One paragraph maximum.

--- STEP 2: ROOT CAUSE ---
Most likely root cause. How did metrics evolve across each state transition
(UP → SUSPECT → QUARANTINED)? Reference exact timestamps and values.

--- STEP 3: REMEDIATION ---
Four clearly labelled sub-sections:
  IMMEDIATE ACTION  — stabilise right now
  SHORT-TERM FIX    — stop recurrence
  LONG-TERM FIX     — architectural improvements
  SENTINEL CONFIG   — exact recommended values for maxSuspectStrikes
                      and quarantineDurationMinutes with justification

PAYLOAD:
{payload}
""".strip()


# ─────────────────────────────────────────────
# Helper
# ─────────────────────────────────────────────
def _extract_step(text: str, start_marker: str, end_marker: Optional[str]) -> str:
    try:
        start = text.index(start_marker) + len(start_marker)
        end   = text.index(end_marker) if end_marker and end_marker in text else len(text)
        return text[start:end].strip()
    except ValueError:
        return text.strip()


# ─────────────────────────────────────────────
# API client (works with both Groq and OpenRouter)
# ─────────────────────────────────────────────
def get_client() -> OpenAI:
    if not API_KEY:
        raise RuntimeError("SAMBANOVA_API_KEY is not configured.")
    return OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
        timeout=120.0,
    )


# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "model": MODEL, "provider": PROVIDER}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    """Blocking analysis — waits for full response then returns."""
    if not request.incidentSnapshots and not request.metricsSnapshots:
        raise HTTPException(status_code=422, detail="At least one snapshot must be provided.")

    try:
        client  = get_client()
        payload = build_cross_reference_payload(
            request.instance, request.incidentSnapshots, request.metricsSnapshots
        )
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": build_prompt(payload, request.analysisTask)},
            ],
            max_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.2,
        )

        combined     = response.choices[0].message.content.strip()
        triage       = _extract_step(combined, "--- STEP 1: TRIAGE ---",      "--- STEP 2")
        root_cause   = _extract_step(combined, "--- STEP 2: ROOT CAUSE ---",  "--- STEP 3")
        remediation  = _extract_step(combined, "--- STEP 3: REMEDIATION ---", None)
        generated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        full_combined = "\n\n".join([
            "=== SENTINEL AI ANALYSIS ===",
            f"Generated at : {generated_at}",
            f"Instance ID  : {request.instance.instanceId}",
            "",
            "--- STEP 1: TRIAGE ---",
            triage,
            "",
            "--- STEP 2: ROOT CAUSE ---",
            root_cause,
            "",
            "--- STEP 3: REMEDIATION ---",
            remediation,
        ])

        return AnalyzeResponse(
            instanceId=request.instance.instanceId,
            generatedAt=generated_at,
            triage=triage,
            rootCause=root_cause,
            remediation=remediation,
            combinedAnalysis=full_combined,
        )

    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")


@app.post("/analyze/stream")
def analyze_stream(request: AnalyzeRequest):
    """Streaming analysis — tokens flow directly to the client as SSE."""
    if not request.incidentSnapshots and not request.metricsSnapshots:
        raise HTTPException(status_code=422, detail="At least one snapshot must be provided.")

    try:
        client  = get_client()
        payload = build_cross_reference_payload(
            request.instance, request.incidentSnapshots, request.metricsSnapshots
        )

        def event_generator():
            full_text = []
            try:
                stream = client.chat.completions.create(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": build_prompt(payload, request.analysisTask)},
                    ],
                    max_tokens=MAX_OUTPUT_TOKENS,
                    temperature=0.2,
                    stream=True,
                )
                for chunk in stream:
                    token = chunk.choices[0].delta.content or ""
                    if token:
                        full_text.append(token)
                        yield f"data: {json.dumps({'token': token})}\n\n"

                combined     = "".join(full_text)
                generated_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                yield f"data: {json.dumps({'done': True, 'generatedAt': generated_at, 'combinedAnalysis': combined})}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    if not API_KEY:
        print("ERROR: SAMBANOVA_API_KEY is not set.")
        sys.exit(1)

    print("──────────────────────────────────────────")
    print("  Sentinel AI Analysis Service  v4.0")
    print(f"  Provider: {PROVIDER}")
    print(f"  Model   : {MODEL}")
    print(f"  Listen  : http://{HOST}:{PORT}")
    print(f"  Docs    : http://{HOST}:{PORT}/docs")
    print("──────────────────────────────────────────")

    uvicorn.run(app, host=HOST, port=PORT)
