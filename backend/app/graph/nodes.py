from app.graph.state import GraphState
from app.services.llm_service import get_llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import sqlite3
import pandas as pd
import json

llm = get_llm()

# --- Prompts ---
GENERATE_SQL_PROMPT = """
You are a SQL Expert. Given an input question and a database schema, generate a valid SQLite query.
Schema:
{schema}

Question: {question}

Restricted Columns (Select only these if not empty): {restricted_columns}
Previous Feedback (if any): {feedback}

Return ONLY the raw SQL query. Do not wrap in markdown or code blocks.
"""

VALIDATE_SQL_PROMPT = """
Check if the following SQL query is valid for SQLite and safe (Read-Only).
Schema:
{schema}

Query: {sql}

Return a JSON object: {{"valid": boolean, "reasoning": "string"}}
"""

# --- Nodes ---

async def generate_sql_node(state: GraphState):
    prompt = ChatPromptTemplate.from_template(GENERATE_SQL_PROMPT)
    chain = prompt | llm | StrOutputParser()
    
    response = await chain.ainvoke({
        "schema": state["schema"],
        "question": state["question"],
        "restricted_columns": state.get("restricted_columns", []),
        "feedback": state.get("feedback", "")
    })
    
    # Clean response
    sql = response.replace("```sql", "").replace("```", "").strip()
    
    return {"sql": sql, "iterations": state["iterations"] + 1}

async def validate_sql_node(state: GraphState):
    prompt = ChatPromptTemplate.from_template(VALIDATE_SQL_PROMPT)
    chain = prompt | llm | StrOutputParser()
    
    response = await chain.ainvoke({
        "schema": state["schema"],
        "sql": state["sql"]
    })
    
    try:
        # Clean response
        cleaned = response.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        return {"valid": data["valid"], "feedback": data["reasoning"]}
    except:
        # If parsing fails, assume valid but warn? Or strictly fail.
        # Fallback for robustness
        return {"valid": True, "feedback": "Validation parsing failed, proceeding cautiously."}

async def execute_sql_node(state: GraphState):
    db_path = state["db_path"]
    sql = state["sql"]
    
    if not db_path:
         return {"valid": False, "feedback": "Database path missing."}

    try:
        conn = sqlite3.connect(db_path)
        # Security: Allow read-only? 
        # SQLite doesn't have strict user permissions in file mode easily, but we can check keywords.
        if "DROP" in sql.upper() or "DELETE" in sql.upper() or "UPDATE" in sql.upper():
             return {"valid": False, "feedback": "Write operations are not allowed."}

        df = pd.read_sql_query(sql, conn)
        result = df.to_dict(orient="records")
        conn.close()
        
        return {"result": result, "valid": True}
    except Exception as e:
        return {"valid": False, "feedback": f"Runtime Error: {str(e)}"}
