import { z } from "zod";
import { model } from "../llm/model";
import { RELEVANCE_CHECK_PROMPT } from "../llm/prompts";

const RelevanceOutput = z.object({
    relevant: z.boolean().describe("Whether the question is relevant to the schema"),
    reasoning: z.string().describe("Why the question is relevant or not"),
});

export const check_relevance_tool = async (question: string, schema: string) => {
    const checker = model.withStructuredOutput(RelevanceOutput);
    const prompt = await RELEVANCE_CHECK_PROMPT.format({ schema, question });
    const result = await checker.invoke(prompt);
    return result.relevant;
};
