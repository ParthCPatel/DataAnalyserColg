from typing import TypedDict, Annotated, List, Any, Optional
from langchain_core.messages import BaseMessage
import operator

class GraphState(TypedDict):
    question: str
    schema: str
    sql: Optional[str]
    result: Optional[Any]
    feedback: Optional[str]
    valid: bool
    iterations: int
    db_path: Optional[str]
    restricted_columns: Optional[List[str]]
    intent: Optional[str]
    upload_id: Optional[str]
