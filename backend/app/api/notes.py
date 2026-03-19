from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.note import NoteCreate, NoteInDB
from app.db.mongo import get_database
from app.api.upload import get_current_user
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime

router = APIRouter()

@router.post("/notes", response_model=NoteInDB)
async def create_note(
    note: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    note_data = NoteInDB(
        userId=str(current_user["_id"]),
        content=note.content
    )
    
    res = await db.notes.insert_one(note_data.dict(by_alias=True, exclude={"id"}))
    created_note = await db.notes.find_one({"_id": res.inserted_id})
    return created_note

@router.get("/notes/{note_id}", response_model=NoteInDB)
async def get_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        note = await db.notes.find_one({"_id": ObjectId(note_id), "userId": str(current_user["_id"])})
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        return note
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

@router.put("/notes/{note_id}", response_model=NoteInDB)
async def update_note(
    note_id: str,
    note: NoteCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        res = await db.notes.find_one_and_update(
            {"_id": ObjectId(note_id), "userId": str(current_user["_id"])},
            {"$set": {"content": note.content, "updatedAt": datetime.utcnow()}},
            return_document=True
        )
        if not res:
            raise HTTPException(status_code=404, detail="Note not found")
        return res
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        res = await db.notes.delete_one({"_id": ObjectId(note_id), "userId": str(current_user["_id"])})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Note not found")
        return {"success": True}
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
