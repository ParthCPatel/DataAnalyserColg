from app.graph.state import GraphState
from app.services.llm_service import get_llm
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import sqlite3
import pandas as pd
import json

llm = get_llm()

# --- Prompts ---
ROUTER_PROMPT = """You are analyzing an intent for a database querying system.
Given the user's question, decide if they want:
1. "data" - A tabular response containing actual raw data pulled via an SQL query (e.g., "show me the top 10 rows", "give me first 1000", "filter by x", "get all the").
2. "chat" - A text-based chatbot response, such as a general question, a request for a "summary of the table" or insights, an explanation, or simple conversational chat.

Question: {question}

Return ONLY a valid JSON object matching this schema:
{{"intent": "data" | "chat"}}
"""

GENERATE_SQL_PROMPT = """
You are a SQL Expert. Given an input question and a database schema, generate a valid SQLite query.
Schema:
{schema}

Question: {question}

Restricted Columns (Select only these if not empty): {restricted_columns}
Previous Feedback (if any): {feedback}

Return ONLY the raw SQL query. Do not wrap in markdown or code blocks. Unless the user specifies a limit, use a default LIMIT 1000 to ensure enough data for visualization.
"""

VALIDATE_SQL_PROMPT = """
Check if the following SQL query is valid for SQLite and safe (Read-Only).
Schema:
{schema}

Query: {sql}

Return a JSON object: {{"valid": boolean, "reasoning": "string"}}
"""

CHAT_PROMPT = """You are a helpful Data Analysis Chatbot.
Based on the following database schema and a preview of the data:
Schema:
{schema}

Preview of first 5 rows:
{preview}

Answer the user's question or summarize the table as requested. Provide a concise, clear text response. Do NOT provide tabular data if they want a summary, just describe it or answer their text question.
Question: {question}
"""

# --- Nodes ---

async def route_intent_node(state: GraphState):
    prompt = ChatPromptTemplate.from_template(ROUTER_PROMPT)
    chain = prompt | llm | StrOutputParser()
    response = await chain.ainvoke({"question": state["question"]})
    try:
        cleaned = response.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        intent = data.get("intent", "data")
    except:
        intent = "data"
        
    return {"intent": intent}
    
async def chat_node(state: GraphState):
    db_path = state["db_path"]
    
    preview_data = {}
    if db_path:
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [r[0] for r in cursor.fetchall()]
            for t in tables:
                df = pd.read_sql_query(f'SELECT * FROM "{t}" LIMIT 5', conn)
                df = df.replace([float('inf'), float('-inf'), float('nan')], None)
                preview_data[t] = df.to_dict(orient="records")
            conn.close()
        except:
            pass

    prompt = ChatPromptTemplate.from_template(CHAT_PROMPT)
    chain = prompt | llm | StrOutputParser()
    response = await chain.ainvoke({
        "schema": state["schema"],
        "preview": json.dumps(preview_data, default=str),
        "question": state["question"]
    })
    
    return {"result": response, "valid": True, "intent": "chat"}

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
        if "DROP" in sql.upper() or "DELETE" in sql.upper() or "UPDATE" in sql.upper():
             return {"valid": False, "feedback": "Write operations are not allowed."}

        df = pd.read_sql_query(sql, conn)
        df = df.replace([float('inf'), float('-inf'), float('nan')], None)
        result = df.to_dict(orient="records")
        conn.close()
        
        return {"result": result, "valid": True}
    except Exception as e:
        return {"valid": False, "feedback": f"Runtime Error: {str(e)}"}
