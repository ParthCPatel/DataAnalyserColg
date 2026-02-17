from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.graph.workflow import app as agent_app
from app.db.mongo import get_database
from app.models.log import UploadLog, QueryLog
from app.services.upload_service import upload_service
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

router = APIRouter()

class SandboxRequest(BaseModel):
    question: str
    uploadId: str
    restrictedColumns: Optional[List[str]] = None
    schema: Optional[str] = None # Optional override

@router.post("/sandbox")
async def sandbox(
    req: SandboxRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
    # user: dict = Depends(get_current_user) # Optional if we want to track user
):
    # 1. Get Upload Log
    try:
        upload_log = await db.uploads.find_one({"_id": ObjectId(req.uploadId)})
    except:
        raise HTTPException(status_code=400, detail="Invalid Upload ID")
        
    if not upload_log:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    db_path = upload_log["path"]
    
    # 2. Get Schema if not provided
    active_schema = req.schema
    if not active_schema:
        state = upload_service.get_database_state(db_path)
        active_schema = state["schema"]
    
    # 3. Invoke Agent
    inputs = {
        "question": req.question,
        "schema": active_schema,
        "db_path": db_path,
        "restricted_columns": req.restrictedColumns,
        "iterations": 0,
        "valid": False,
        "feedback": None,
        "result": None,
        "sql": None
    }
    
    try:
        final_state = await agent_app.ainvoke(inputs)
    except Exception as e:
        print(f"Agent Error: {e}")
        raise HTTPException(status_code=500, detail=f"Agent Execution Failed: {str(e)}")
    
    # 4. Log Query
    # ... (Implementation of logging similar to Node)
    
    return {
        "status": "success",
        "generatedSQL": final_state.get("sql"),
        "answer": final_state.get("result"),
        "validation": final_state.get("valid"),
        "feedback": final_state.get("feedback")
    }
