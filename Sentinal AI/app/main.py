import json
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
        )
        try:
            return json.loads(result)
        except Exception:
            return {"raw_response": result}
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
