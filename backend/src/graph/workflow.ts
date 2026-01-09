import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphState } from "./state";
import { generate_sql_node, validate_sql_node, execute_sql_node } from "./nodes";

const shouldContinue = (state: typeof GraphState.State) => {
    if (state.valid) {
        return "execute_sql";
    }
    
    if ((state.iterations || 0) >= 3) {
        return END; // Safety break after 3 attempts
    }

    return "generate_sql";
};

const shouldContinueExecution = (state: typeof GraphState.State) => {
    // If execution didn't fail, valid is true (from validator)
    // If execution caught error, it set valid: false
    // So if valid, we are done.
    if (state.valid) {
        return END;
    }
    
    if ((state.iterations || 0) >= 3) {
        return END; 
    }

    return "generate_sql";
};

const workflow = new StateGraph(GraphState)
    .addNode("generate_sql", generate_sql_node)
    .addNode("validate_sql", validate_sql_node)
    .addNode("execute_sql", execute_sql_node)
    .addEdge(START, "generate_sql")
    .addEdge("generate_sql", "validate_sql")
    .addConditionalEdges(
        "validate_sql",
        shouldContinue,
    )
    .addConditionalEdges(
        "execute_sql",
        shouldContinueExecution,
    );

export const app = workflow.compile();
