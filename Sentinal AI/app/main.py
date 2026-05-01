import json
import re
from fastapi import FastAPI, HTTPException
from app.models import AnalyzeInstanceRequest
from app.agent import analyze_instance

app = FastAPI(title="Sentinal AI Agent Service")

@app.get("/")
def root():
    return {"status": "Sentinal AI Agent is running"}

@app.post("/agent/analyze-instance")
async def analyze(request: AnalyzeInstanceRequest):
    try:
        result = await analyze_instance(
            instance_id=request.instance_id,
            user_question=request.user_question,
            snapshot_id=request.snapshot_id,
            agent_context=request.agent_context,
            allowed_tools=request.allowed_tools,
            chat_history=request.chat_history,
        )
        try:
            return json.loads(_extract_json(result))
        except Exception:
            return {"raw_response": result}
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _extract_json(value: str) -> str:
    raw = (value or "").strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, flags=re.IGNORECASE)
    if fenced:
        raw = fenced.group(1).strip()

    if raw.startswith("{") and raw.endswith("}"):
        return raw

    first = raw.find("{")
    last = raw.rfind("}")
    if first == -1 or last == -1 or last <= first:
        return raw
    return raw[first:last + 1].strip()
