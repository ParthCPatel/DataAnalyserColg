from fastapi import APIRouter, HTTPException, Depends
from app.db.mongo import get_database
from app.api.upload import get_current_user # specific dependency
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.log import QueryLog

router = APIRouter()

@router.get("/history/sessions")
@router.get("/history/sessions")
async def get_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # 1. Fetch all uploads for the user
    cursor = db.uploads.find({"userId": str(current_user["_id"])}).sort("createdAt", -1)
    uploads = await cursor.to_list(length=100)
    
    sessions = []
    
    for upload in uploads:
        upload["_id"] = str(upload["_id"])
        
        # 2. Fetch queries for this upload
        q_cursor = db.queries.find({
            "userId": str(current_user["_id"]),
            "uploadId": upload["_id"]
        }).sort("createdAt", 1) # Oldest first for chat history flow
        
        queries = await q_cursor.to_list(length=100)
        
        # Format queries
        formatted_queries = []
        last_active = upload["createdAt"]
        
        for q in queries:
            q["_id"] = str(q["_id"])
            if "createdAt" in q:
                last_active = q["createdAt"]
            # Map 'result' to 'answer' if needed by frontend, or ensure consistent naming
            # The frontend seems to use 'item.answer' in Dashboard but 'queries' here.
            # Let's keep the raw query object but ensure ID is string
            formatted_queries.append(q)
            
        sessions.append({
            "upload": upload,
            "queries": formatted_queries,
            "lastActive": last_active
        })
    
    import math
    def sanitize_floats(obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
            return obj
        elif isinstance(obj, dict):
            return {k: sanitize_floats(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [sanitize_floats(v) for v in obj]
        return obj

    # Sort sessions by lastActive descending (most recent interaction first)
    sessions.sort(key=lambda x: x["lastActive"], reverse=True)
    
    return sanitize_floats(sessions)

@router.delete("/history/query/{query_id}")
async def delete_query(
    query_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    from bson import ObjectId
    try:
        res = await db.queries.delete_one({
            "_id": ObjectId(query_id),
            "userId": str(current_user["_id"])
        })
        if res.deleted_count == 0:
             raise HTTPException(status_code=404, detail="Query not found or unauthorized")
        return {"status": "success", "message": "Query deleted"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid ID")

@router.delete("/history/session/{upload_id}")
async def delete_session(
    upload_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    from bson import ObjectId
    import os
    try:
        # 1. Get Upload to find file path
        upload = await db.uploads.find_one({
            "_id": ObjectId(upload_id),
            "userId": str(current_user["_id"])
        })
        
        if not upload:
             raise HTTPException(status_code=404, detail="Session not found or unauthorized")
             
        # 2. Delete File
        if "path" in upload and os.path.exists(upload["path"]):
            try:
                os.remove(upload["path"])
            except:
                pass # Ignore file cleanup errors
                
        # 3. Delete Queries
        await db.queries.delete_many({
            "uploadId": upload_id,
            "userId": str(current_user["_id"])
        })
        
        # 4. Delete Upload Record
        await db.uploads.delete_one({
            "_id": ObjectId(upload_id)
        })
        
        return {"status": "success", "message": "Session deleted"}
    except Exception as e:
        print(f"Delete Session Error: {e}")
        raise HTTPException(status_code=400, detail="Invalid ID or Error")
