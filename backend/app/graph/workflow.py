from langgraph.graph import StateGraph, END
from app.graph.state import GraphState
from app.graph.nodes import route_intent_node, chat_node, generate_sql_node, validate_sql_node, execute_sql_node

def route_initial(state: GraphState):
    if state.get("intent") == "chat":
        return "chat"
    return "generate_sql"

def should_continue(state: GraphState):
    if state["valid"]:
        return "execute_sql"
    if state["iterations"] >= 3:
        return END
    return "generate_sql"

def should_end(state: GraphState):
    if state["valid"] and state.get("result") is not None:
        return END
    if state["iterations"] >= 3:
        return END
    return "generate_sql"

workflow = StateGraph(GraphState)

workflow.add_node("route_intent", route_intent_node)
workflow.add_node("chat", chat_node)
workflow.add_node("generate_sql", generate_sql_node)
workflow.add_node("validate_sql", validate_sql_node)
workflow.add_node("execute_sql", execute_sql_node)

workflow.set_entry_point("route_intent")

workflow.add_conditional_edges(
    "route_intent",
    route_initial,
    {
        "chat": "chat",
        "generate_sql": "generate_sql"
    }
)

workflow.add_edge("chat", END)
workflow.add_edge("generate_sql", "validate_sql")

workflow.add_conditional_edges(
    "validate_sql",
    should_continue
)

workflow.add_conditional_edges(
    "execute_sql",
    should_end
)

app = workflow.compile()
