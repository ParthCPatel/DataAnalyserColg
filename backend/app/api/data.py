from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.db.mongo import get_database
from app.api.upload import get_current_user
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
import sqlite3
import os

router = APIRouter()

class DeleteTableRequest(BaseModel):
    uploadId: str
    tableName: str

@router.delete("/table")
async def delete_table(
    req: DeleteTableRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # 1. Get Log
    try:
        upload_log = await db.uploads.find_one({"_id": ObjectId(req.uploadId)})
    except:
         raise HTTPException(status_code=400, detail="Invalid Upload ID")
         
    if not upload_log:
        raise HTTPException(status_code=404, detail="Upload not found")
    
    db_path = upload_log["path"]
    from app.services.upload_service import upload_service
    local_path = upload_service.get_local_path(db_path)
    
    # PERSISTENCE: Restore from MongoDB if missing locally
    if not os.path.exists(local_path):
         await upload_service.retrieve_db_from_mongo(db_path, req.uploadId, db)
    
    if not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail="Database file not found and could not be restored")
        
    # 2. Drop Table
    try:
        conn = sqlite3.connect(local_path)
        cursor = conn.cursor()
        cursor.execute(f'DROP TABLE IF EXISTS "{req.tableName}"')
        conn.commit()
        conn.close()
        return {"message": "Table deleted successfully", "tableName": req.tableName}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
