from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from typing import List
from app.services.upload_service import upload_service
from app.db.mongo import get_database
from app.models.log import UploadLog
from app.core.security import create_access_token, get_current_user
from app.models.user import UserResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import shutil
from datetime import datetime



router = APIRouter()

@router.post("/upload-db")
async def upload_db(
    files: List[UploadFile] = File(..., alias="database"), 
    clean: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # 1. Save temp files
    temp_paths = []
    original_names = []
    
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No files uploaded")

        for file in files:
            timestamp = int(datetime.utcnow().timestamp())
            filename = f"{timestamp}_{file.filename}"
            # Ensure upload_dir exists
            if not os.path.exists(upload_service.upload_dir):
                os.makedirs(upload_service.upload_dir)
            
            file_path = os.path.join(upload_service.upload_dir, filename)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            temp_paths.append(file_path)
            original_names.append(file.filename)

        # 2. Process to SQLite
        # Note: clean logic is not yet implemented fully in service, but structure allows it.
        master_db_path, table_names = await upload_service.process_csv_to_sqlite(temp_paths, original_names)
        
        # 3. Get State
        state = upload_service.get_database_state(master_db_path)
        
        # 4. Cleanup Temp CSVs
        for p in temp_paths:
            if os.path.exists(p):
                os.remove(p)

        # 5. Log to MongoDB
        new_upload = UploadLog(
            filename=os.path.basename(master_db_path),
            originalName=f"Merged ({len(files)} files)" if len(files) > 1 else original_names[0],
            path=master_db_path,
            userId=str(current_user["_id"])
        )
        
        res = await db.uploads.insert_one(new_upload.dict(by_alias=True, exclude={"id"}))
        upload_id = str(res.inserted_id)

        # 6. PERSIST to MongoDB (Binary for Render)
        await upload_service.persist_db_to_mongo(master_db_path, upload_id, db)

        return {
            "status": "success",
            "message": f"Successfully processed {len(files)} files.",
            "schema": state["schema"],
            "filename": new_upload.filename,
            "path": master_db_path,
            "databaseState": state["databaseState"],
            "uploadId": upload_id
        }

    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from bson import ObjectId

@router.post("/append")
async def append_db(
    database: UploadFile = File(...),
    uploadId: str = Form(...),
    clean: bool = Query(False),
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        # Find the existing upload session
        upload_log = await db.uploads.find_one({"_id": ObjectId(uploadId), "userId": str(current_user["_id"])})
        if not upload_log:
            raise HTTPException(status_code=404, detail="Upload session not found")

        master_db_path = upload_log.get("path")
        if not master_db_path:
            raise HTTPException(status_code=404, detail="Database path not found in logs")

        # PERSISTENCE: Restore from MongoDB if missing locally
        restored = await upload_service.retrieve_db_from_mongo(master_db_path, uploadId, db)
        if not restored:
             raise HTTPException(status_code=404, detail="Database file not found on server or in backup")

        # Save temp file
        timestamp = int(datetime.utcnow().timestamp())
        filename = f"{timestamp}_{database.filename}"
        if not os.path.exists(upload_service.upload_dir):
            os.makedirs(upload_service.upload_dir)
        
        file_path = os.path.join(upload_service.upload_dir, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(database.file, buffer)
            
        # Append to SQLite
        _, table_names = await upload_service.process_csv_to_sqlite(
            csv_paths=[file_path], 
            original_names=[database.filename], 
            master_db_path=master_db_path
        )
        
        # Get State
        state = upload_service.get_database_state(master_db_path)
        
        # PERSISTENCE: Update the binary storage in MongoDB
        await upload_service.persist_db_to_mongo(master_db_path, uploadId, db)

        # Cleanup
        if os.path.exists(file_path):
            os.remove(file_path)

        return {
            "status": "success",
            "message": f"Successfully appended {database.filename}",
            "schema": state["schema"],
            "databaseState": state["databaseState"]
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Append Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
