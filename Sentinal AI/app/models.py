from pydantic import BaseModel
from typing import Any, Dict, List, Optional

class AnalyzeInstanceRequest(BaseModel):
    instance_id: str
    user_question: Optional[str] = None
    snapshot_id: Optional[int] = None
    agent_context: Optional[Dict[str, Any]] = None
    allowed_tools: Optional[List[str]] = None
    chat_history: Optional[List[Dict[str, str]]] = None

class AgentResponse(BaseModel):
    severity: str
    root_cause: str
    evidence: List[str]
    recommended_actions: List[str]
    auto_executable: bool
    tools_used: List[str] = []
    
