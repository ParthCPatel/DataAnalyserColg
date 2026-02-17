from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from typing import List
from app.services.upload_service import upload_service
from app.db.mongo import get_database
from app.models.log import UploadLog
from app.core.security import create_access_token # Not needed here but for compilation
from app.models.user import UserResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import shutil
from datetime import datetime

# Auth dependency (placeholder until we have a proper get_current_user)
# For now, we assume user passed in header or we mock it. 
# But let's reuse security.py if possible or create a dependency.

from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import get_settings

settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncIOMotorDatabase = Depends(get_database)):
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = await db.users.find_one({"_id": PyObjectId(user_id)}) # Using helper from models? Handled by driver mostly
    # ObjectId handling in motor is usually automatic if passed as ObjectId, 
    # but here we get string from JWT. We need to convert.
    from bson import ObjectId
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if user is None:
        raise credentials_exception
    return user

router = APIRouter()

@router.post("/upload-db")
async def upload_db(
    files: List[UploadFile] = File(...), 
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
        for file in files:
            timestamp = int(datetime.utcnow().timestamp())
            filename = f"{timestamp}_{file.filename}"
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
