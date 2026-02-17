from fastapi import APIRouter, HTTPException, Depends
from app.db.mongo import get_database
from app.api.upload import get_current_user # specific dependency
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.log import QueryLog

router = APIRouter()

@router.get("/history")
async def get_history(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # Fetch queries for user, sorted by date desc
    cursor = db.queries.find({"userId": str(current_user["_id"])}).sort("createdAt", -1).limit(50)
    queries = await cursor.to_list(length=50)
    
    # Convert ObjectIds to strings for JSON
    results = []
    for q in queries:
        q["_id"] = str(q["_id"])
        if "uploadId" in q and q["uploadId"]:
             q["uploadId"] = str(q["uploadId"])
        results.append(q)
        
    return results

@router.delete("/history/{query_id}")
async def delete_history(
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
