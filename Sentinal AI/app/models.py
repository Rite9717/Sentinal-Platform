from pydantic import BaseModel
from typing import List, Optional

class AnalyzeInstanceRequest(BaseModel):
    instance_id: str
    user_question: Optional[str] = None
    snapshot_id: Optional[int] = None

class AgentResponse(BaseModel):
    severity: str
    root_cause: str
    evidence: List[str]
    recommended_actions: List[str]
    auto_executable: bool
    
