import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from app.services.upload_service import upload_service
from app.services.llm_service import get_llm
from app.db.mongo import get_database
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
import json

router = APIRouter()
llm = get_llm()

class GraphAnalyzeRequest(BaseModel):
    title: str
    data: Any

@router.post("/analyze-graph")
async def analyze_graph(req: GraphAnalyzeRequest):
    """
    Analyze graph data directly (non-database dependent)
    """
    try:
        # 1. Format Data Context
        data_str = json.dumps(req.data, default=str)
        
        system_prompt = f"""
        Act as a Senior Data Analyst. You are given the data for a chart titled "{req.title}".
        
        DATA:
        {data_str}
        
        Provide a professional analysis of this chart in a clear, concise format.
        Focus on trends, significant peaks/valleys, and a final insight or recommendation.
        Keep the tone expert and actionable.
        Return ONLY the analysis text (Markdown is okay).
        """
        
        # 2. Invoke LLM
        # Use a simple human message instead of a template with no variables
        from langchain_core.messages import HumanMessage
        response = await llm.ainvoke([HumanMessage(content=system_prompt)])
        
        # Extract text from response
        analysis_text = response.content if hasattr(response, 'content') else str(response)

        if not analysis_text:
            raise Exception("AI returned empty analysis")

        return {
            "status": "success",
            "analysis": str(analysis_text)
        }
    except Exception as e:
        print(f"Graph Analysis Error: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

class AnalyzeRequest(BaseModel):
    uploadId: str
    tableNames: Optional[List[str]] = None
    tableName: Optional[str] = None # Legacy support

@router.post("/analyze-table")
async def analyze_table(
    req: AnalyzeRequest,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    # 1. Resolve Targets
    targets = req.tableNames or ([req.tableName] if req.tableName else [])
    if not targets:
        raise HTTPException(status_code=400, detail="Missing table targets")

    # 2. Get DB Path
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
    
    # 3. Get Data Context
    context_data = []
    try:
        # We need a helper in upload_service to get simple rows/schema for specific tables
        # For now, let's reuse get_database_state but it fetches everything. 
        # Better to make a targeted fetch.
        # Let's add a quick helper here or assume we use the full state for now?
        # Full state might be heavy. Let's do a targeted fetch using sqlite3 directly here 
        # or expand upload_service. Let's keep it simple here.
        import sqlite3
        conn = sqlite3.connect(local_path)
        cursor = conn.cursor()
        
        for t in targets:
            cursor.execute(f'PRAGMA table_info("{t}")')
            columns = [r[1] for r in cursor.fetchall()]
            
            cursor.execute(f'SELECT * FROM "{t}" LIMIT 20')
            rows = [list(r) for r in cursor.fetchall()] # Convert tuples to lists
            
            context_data.append({
                "tableName": t,
                "columns": columns,
                "rows": rows
            })
        conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database Access Failed: {str(e)}")

    if not context_data:
         return {"status": "success", "analysis": {"summary": "No data found."}}

    # 4. LLM Prompt
    is_multi = len(context_data) > 1
    data_prompt = ""
    for d in context_data:
        data_prompt += f"""
        === TABLE: {d['tableName']} ===
        Columns: {d['columns']}
        Sample Data (first 20 rows):
        {d['rows']}
        """

    system_prompt = f"""
    Act as a Senior Data Analyst. Analyze the following local database table(s).
    {data_prompt}
    
    {'Identify relationships (Foreign Keys), join opportunities, or correlations BETWEEN tables.' if is_multi else 'Analyze distributions and patterns.'}

    Provide a "Deep Dive" analysis in strictly valid JSON format:
    {{{{
        "summary": "Brief 1-2 sentence overview.",
        "trends": ["List 2-4 key trends/patterns."],
        "anomalies": ["List 1-2 potential outliers."],
        "questions": ["List 3 complex questions that reveal deep insights."]
    }}}}
    """
    
    try:
        # Using JsonOutputParser for robustness
        parser = JsonOutputParser()
        chain = ChatPromptTemplate.from_template(system_prompt) | llm | parser
        analysis = await chain.ainvoke({})
        
        return {
            "status": "success",
            "analysis": analysis
        }
    except Exception as e:
        # Fallback if JSON parsing fails
        print(f"Analysis LLM Error: {e}")
        return {
            "status": "success", # Don't error out valid request
            "analysis": {
                "summary": "Analysis generation failed.",
                "trends": [],
                "anomalies": [],
                "questions": []
            }
        }
