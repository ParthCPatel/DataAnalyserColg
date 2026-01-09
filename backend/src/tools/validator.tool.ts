import { z } from "zod";
import { model } from "../llm/model";
import { SQL_VALIDATION_PROMPT } from "../llm/prompts";


const ValidationOutput = z.object({
    valid: z.boolean().describe("Whether the SQL query is valid according to the schema"),
    reasoning: z.string().describe("Explanation of why the query is valid or invalid"),
});

export const validator_tool = async (sql: string, schema: string) => {
    const validator = model.withStructuredOutput(ValidationOutput);
    const prompt = await SQL_VALIDATION_PROMPT.format({ schema, query: sql });
    const result = await validator.invoke(prompt);
    return result;
};