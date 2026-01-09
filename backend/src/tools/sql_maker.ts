
import llm from '../llm/model';
import SQL_GENERATION_PROMPT from '../llm/prompts';


// const schema = get_schema();
// const question = "show me the sales data";
export const sql_maker = async (question: string, schema: string, feedback: string = "", restrictedColumns: string[] = []) => {
    console.log(`[SQL_MAKER] Making SQL for: "${question}". Restricted Columns:`, restrictedColumns);
    const columnsText = restrictedColumns.length > 0 ? restrictedColumns.join(", ") : "ALL COLUMNS ALLOWED";
    const prompt = await SQL_GENERATION_PROMPT.format({
        question, 
        schema, 
        feedback,
        restrictedColumns: columnsText
    });
    const sql = await llm.invoke(prompt);
    return sql.sql; // Note: if LLM returns JSON error, this might be stringified JSON. Validator needs to handle it or we catch it here.
};