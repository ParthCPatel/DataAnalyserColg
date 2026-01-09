import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import path from "path";
import dotenv from "dotenv";

// Load env from project root (not src/.env) so model selection is consistent.
dotenv.config({ path: path.join(__dirname, "../../.env") });

const StructuredOutputParser = z.object({
  sql: z
    .string()
    .describe("The SQL query to answer the question based on schema"),
});
export const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0,
});  



const llm = model.withStructuredOutput(StructuredOutputParser);

export default llm;
