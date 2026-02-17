from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from app.db.mongo import get_database
from app.api.upload import get_current_user
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime

router = APIRouter()

# --- Models ---
class DashboardBase(BaseModel):
    name: str
    description: Optional[str] = None
    layout: List[Dict[str, Any]] = [] # React-Grid-Layout items
    graphs: List[Dict[str, Any]] = [] # Graph definitions

class DashboardCreate(DashboardBase):
    pass

class SavedGraphBase(BaseModel):
    title: str
    type: str # 'bar', 'line', etc.
    config: Dict[str, Any]
    queryId: Optional[str] = None

class SavedGraphCreate(SavedGraphBase):
    pass

# --- Saved Graphs Endpoints ---

@router.post("/saved-graphs")
async def save_graph(
    graph: SavedGraphCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    new_graph = graph.dict()
    new_graph["userId"] = str(current_user["_id"])
    new_graph["createdAt"] = datetime.utcnow()
    
    res = await db.saved_graphs.insert_one(new_graph)
    return {"status": "success", "id": str(res.inserted_id)}

@router.get("/saved-graphs")
async def get_saved_graphs(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    cursor = db.saved_graphs.find({"userId": str(current_user["_id"])})
    graphs = await cursor.to_list(length=100)
    for g in graphs:
        g["_id"] = str(g["_id"])
    return graphs

@router.delete("/saved-graphs/{graph_id}")
async def delete_graph(
    graph_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        res = await db.saved_graphs.delete_one({"_id": ObjectId(graph_id), "userId": str(current_user["_id"])})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Graph not found")
        return {"status": "success"}
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

# --- Dashboard Endpoints ---

@router.post("/dashboard")
async def create_dashboard(
    dashboard: DashboardCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    new_dash = dashboard.dict()
    new_dash["userId"] = str(current_user["_id"])
    new_dash["createdAt"] = datetime.utcnow()
    
    res = await db.dashboards.insert_one(new_dash)
    return {"status": "success", "id": str(res.inserted_id)}

@router.get("/dashboard")
async def get_dashboards(
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    cursor = db.dashboards.find({"userId": str(current_user["_id"])})
    dashes = await cursor.to_list(length=20)
    for d in dashes:
        d["_id"] = str(d["_id"])
    return dashes

@router.get("/dashboard/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        dash = await db.dashboards.find_one({"_id": ObjectId(dashboard_id), "userId": str(current_user["_id"])})
        if not dash:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        dash["_id"] = str(dash["_id"])
        return dash
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")

@router.put("/dashboard/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    dashboard: DashboardCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    try:
        res = await db.dashboards.update_one(
            {"_id": ObjectId(dashboard_id), "userId": str(current_user["_id"])},
            {"$set": dashboard.dict()}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        return {"status": "success"}
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
