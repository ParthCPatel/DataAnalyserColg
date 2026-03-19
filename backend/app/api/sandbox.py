import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.graph.workflow import app as agent_app
from app.db.mongo import get_database
from app.models.log import UploadLog, QueryLog
from app.services.upload_service import upload_service
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import json

from app.core.security import get_current_user
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

router = APIRouter()

class SandboxRequest(BaseModel):
    question: Optional[str] = None
    uploadId: str
    restrictedColumns: Optional[List[str]] = None
    schema: Optional[str] = None # Optional override

@router.post("/sandbox")
async def sandbox(
    req: SandboxRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    # 1. Get Upload Log
    try:
        upload_log = await db.uploads.find_one({"_id": ObjectId(req.uploadId)})
    except:
        raise HTTPException(status_code=400, detail="Invalid Upload ID")
        
    if not upload_log:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    db_path = upload_log["path"]
    local_path = upload_service.get_local_path(db_path)
    
    # PERSISTENCE: Restore from MongoDB if missing locally
    if not os.path.exists(local_path):
         await upload_service.retrieve_db_from_mongo(db_path, req.uploadId, db)
    
    # 2. Get Schema if not provided
    active_schema = req.schema
    if not active_schema:
        state = upload_service.get_database_state(db_path)
        active_schema = state["schema"]
    
    # 3. Invoke Agent or Just Return State
    if req.question and req.question.strip():
        inputs = {
            "question": req.question,
            "schema": active_schema,
            "db_path": local_path,
            "restricted_columns": req.restrictedColumns,
            "iterations": 0,
            "valid": False,
            "feedback": None,
            "result": None,
            "sql": None,
            "intent": None,
            "upload_id": req.uploadId
        }
        
        try:
            final_state = await agent_app.ainvoke(inputs)
        except Exception as e:
            print(f"Agent Error: {e}")
            raise HTTPException(status_code=500, detail=f"Agent Execution Failed: {str(e)}")
        
        # Save Query Log
        try:
            query_log = QueryLog(
                question=req.question,
                generatedSQL=final_state.get("sql") or "",
                resultSummary=json.dumps(final_state.get("result"), default=str) if final_state.get("result") else "[]",
                result=final_state.get("result"),
                uploadId=req.uploadId,
                userId=str(current_user["_id"]), 
                title=req.question[:50]
            )
            res = await db.queries.insert_one(query_log.dict(by_alias=True, exclude={"id"}))
            query_id = str(res.inserted_id)
        except Exception as e:
            print(f"Failed to save query log: {e}")
            query_id = None
        
        return {
            "status": "success",
            "generatedSQL": final_state.get("sql"),
            "answer": final_state.get("result"),
            "validation": final_state.get("valid"),
            "feedback": final_state.get("feedback"),
            "queryId": query_id
        }
    else:
        # Just return state for refresh
        if not os.path.exists(db_path):
             await upload_service.retrieve_db_from_mongo(db_path, req.uploadId, db)
             
        state = upload_service.get_database_state(db_path)
        return {
            "status": "success",
            "schema": state["schema"],
            "databaseState": state["databaseState"]
        }
