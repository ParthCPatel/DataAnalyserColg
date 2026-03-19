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
    name: str = "My Dashboard"
    description: Optional[str] = None
    items: List[Dict[str, Any]] = [] 

class DashboardCreate(DashboardBase):
    pass

class SavedGraphBase(BaseModel):
    title: str
    content: Dict[str, Any]
    queryId: Optional[str] = None

class SavedGraphCreate(SavedGraphBase):
    pass

class DashboardItemCreate(BaseModel):
    type: str
    title: str
    content: Any
    layout: Dict[str, Any]
    uploadId: Optional[str] = None

class DashboardSave(BaseModel):
    items: List[Dict[str, Any]]
    uploadId: Optional[str] = None

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

# --- Dashboard Endpoints (Singleton per User/Upload) ---

async def get_or_create_dashboard(db, user_id, upload_id):
    query = {"userId": user_id, "uploadId": upload_id}
    dash = await db.dashboards.find_one(query)
    if not dash:
        new_dash = {
            "userId": user_id,
            "uploadId": upload_id,
            "name": "My Dashboard",
            "items": [],
            "createdAt": datetime.utcnow()
        }
        res = await db.dashboards.insert_one(new_dash)
        dash = await db.dashboards.find_one({"_id": res.inserted_id})
    return dash

@router.get("/dashboard")
async def get_dashboard(
    uploadId: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    dash = await get_or_create_dashboard(db, str(current_user["_id"]), uploadId)
    dash["_id"] = str(dash["_id"])
    return dash

@router.post("/dashboard/item")
async def add_dashboard_item(
    item: DashboardItemCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    user_id = str(current_user["_id"])
    dash = await get_or_create_dashboard(db, user_id, item.uploadId)
    
    new_item = item.dict()
    new_item["id"] = str(ObjectId()) 
    
    # Ensure layout exists and has 'i'
    if "layout" not in new_item:
        new_item["layout"] = {"w": 4, "h": 220, "minW": 3, "minH": 60}
    
    new_item["layout"]["i"] = new_item["id"]

    # --- Auto-Placement Logic ---
    existing_items = dash.get("items", [])
    
    # 1. Normalize Existing Items to High-Res (2px units)
    # Rules matched from Frontend: if h < 50, it's legacy (scale * 20)
    normalized_rects = []
    for ex in existing_items:
        layout = ex.get("layout", {})
        x = layout.get("x", 0)
        y = layout.get("y", 0)
        w = layout.get("w", 4)
        h = layout.get("h", 10)
        
        if h < 50: # Legacy
            y = y * 20
            h = h * 20
        
        normalized_rects.append({"x": x, "y": y, "w": w, "h": h})

    # 2. Normalize New Item dimensions
    target_w = new_item["layout"].get("w", 4)
    raw_target_h = new_item["layout"].get("h", 11)
    
    target_h = raw_target_h
    if target_h < 50:
        target_h = target_h * 20
        
    # Update new item to use High-Res units permanently
    new_item["layout"]["w"] = target_w
    new_item["layout"]["h"] = target_h
    # Ensure min dimensions are also reasonable
    if new_item["layout"].get("minH", 0) < 50:
         new_item["layout"]["minH"] = 60 # Default min ~120px

    # 3. Find First Available Slot (First Fit)
    # Check Y candidates from 0 and bottoms of existing items
    y_candidates = {0}
    for r in normalized_rects:
        y_candidates.add(r["y"] + r["h"])
    
    sorted_ys = sorted(list(y_candidates))
    
    MAX_COLS = 12
    final_x, final_y = 0, 0
    placed = False

    def intersects(r1, r2):
        return not (
            r1["x"] + r1["w"] <= r2["x"] or
            r1["x"] >= r2["x"] + r2["w"] or
            r1["y"] + r1["h"] <= r2["y"] or
            r1["y"] >= r2["y"] + r2["h"]
        )

    for cy in sorted_ys:
        # Check all possible X positions at this Y
        for cx in range(MAX_COLS - target_w + 1):
            candidate = {"x": cx, "y": cy, "w": target_w, "h": target_h}
            collision = False
            for r in normalized_rects:
                if intersects(candidate, r):
                    collision = True
                    break
            
            if not collision:
                final_x = cx
                final_y = cy
                placed = True
                break
        if placed:
            break
            
    # Fallback: if somehow logic fails, put at bottom
    if not placed and sorted_ys:
        final_y = sorted_ys[-1]

    new_item["layout"]["x"] = final_x
    new_item["layout"]["y"] = final_y

    await db.dashboards.update_one(
        {"_id": dash["_id"]},
        {"$push": {"items": new_item}}
    )
    
    return new_item

@router.post("/dashboard/save")
async def save_dashboard_layout(
    payload: DashboardSave,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    user_id = str(current_user["_id"])
    await db.dashboards.update_one(
        {"userId": user_id, "uploadId": payload.uploadId},
        {"$set": {"items": payload.items}}
    )
    return {"status": "success"}

@router.delete("/dashboard/item/{item_id}")
async def delete_dashboard_item(
    item_id: str,
    uploadId: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    user_id = str(current_user["_id"])
    await db.dashboards.update_one(
        {"userId": user_id, "uploadId": uploadId},
        {"$pull": {"items": {"id": item_id}}}
    )
    return {"status": "success"}
