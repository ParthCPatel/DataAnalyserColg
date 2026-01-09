import { Annotation } from "@langchain/langgraph";

export const GraphState = Annotation.Root({
    question: Annotation<string>,
    schema: Annotation<string>,
    db: Annotation<any>,
    sql: Annotation<string>,
    valid: Annotation<boolean>,
    feedback: Annotation<string>,
    result: Annotation<any>,
    iterations: Annotation<number>,
    restrictedColumns: Annotation<string[]>,
});
