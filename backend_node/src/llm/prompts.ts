import { PromptTemplate } from "@langchain/core/prompts";

const SQL_GENERATION_PROMPT = new PromptTemplate({
  template: `
You are a SQL query generator. Given a natural language question, generate a SQL query that answers the question.

Rules:
1. Use the EXACT table names and column names from the provided schema. Do not change casing. If the schema uses quotes (e.g. "TableName"), you MUST use quotes.
2. For calculated values (MAX, COUNT, AVG, etc.), YOU MUST provide a readable alias (e.g. SELECT MAX(price) AS highest_price).
3. If data is stored as text (e.g. '1,200.50'), use REPLACE and CAST to convert it to numbers before aggregating.

IMPORTANT:    REQUIRED OUTPUT COLUMNS:
    The user has explicitly selected these columns to be in the result:
    {restrictedColumns}

    INSTRUCTIONS:
    1. You MUST include the "REQUIRED OUTPUT COLUMNS" in your SELECT statement.
    2. You MAY use any other columns from the schema for filtering (WHERE), sorting (ORDER BY), or joining, even if they are not in the required list.
    3. If the user asks for "all deposits", make sure to SELECT the 'Deposits' column (and Description if available) and filter by the Date in the WHERE clause.
    4. Do not include extra columns in the SELECT clause unless necessary for the answer context or specifically asked for.

Question: {question}

Schema: {schema}

Feedback from previous attempt (if any): {feedback}

Remember: If you need a column that is not in "Available Columns", you MUST return the JSON error.
Query:
`,
  inputVariables: ["question", "schema", "feedback", "restrictedColumns"],
});

export const SQL_VALIDATION_PROMPT = new PromptTemplate({
  template: `
    You are a SQL validator. Given a SQL query and database schema, analyze if the query is valid and follows best practices.
    
    Schema: {schema}
    
    Query: {query}
    
    Check for:
    1. Syntax errors
    2. **SQLite Date Handling**:
       - Dates are stored as TEXT in format "DD-Mon-YYYY" (e.g., "21-Aug-2023").
       - DO NOT use \`EXTRACT\`, \`DATE_PART\`, or \`MONTH()\`. They do not work in SQLite.
       - To filter by date, use string matching or \`strftime\`.
       - **Best Practice**: Use \`LOWER(Date) LIKE '%21-aug%'\` to ensure case-insensitive matching.
       - Example: \`SELECT * FROM table WHERE LOWER(Date) LIKE '%21-aug%'\`
       
    3. **String Matching**:
       - Always use \`LOWER(column) LIKE '%value%'\` for text filters to avoid case issues.
       - Do NOT use exact \`=\` unless you are 100% sure of the casing.

    4. **Casting**:
       - If a column looks like a number but is TEXT (e.g. "1,200.00"), use \`CAST(REPLACE(col, ',', '') AS REAL)\` before math.
       - For dates, just treat them as strings unless you need to sort, in which case convert them using substring logic if needed.
    5. Table/column existence in schema
    6. Proper join conditions
    7. Logical correctness
    
    Respond with a JSON object containing:
    - valid: boolean
    - reasoning: string explanation
    `,
  inputVariables: ["schema", "query"],
});

export const RELEVANCE_CHECK_PROMPT = new PromptTemplate({
  template: `
    You are a database expert. Your task is to determine if a natural language question can be answered using ONLY the provided database schema.
    
    Schema:
    {schema}
    
    Question:
    {question}
    
    Analyze the question and schema:
    1. Does the question refer to tables or concepts present in the schema?
    2. Can a SQL query be constructed from the schema to answer the question?
    3. IMPORTANT: If the question mentions specific values (e.g. names, categories, types like "Bill", "Salary") that are not in the schema, ASSUME they are values within a column and return relevant: true.
    
    If the question is completely unrelated to the schema (e.g. asking about "weather" when schema is about "users"), return relevant: false.
    If you are unsure, ALWAYS return relevant: true. Allow the SQL generator to attempt a query.
    
    Respond with a JSON object:
    - relevant: boolean
    - reasoning: string explanation
    `,
  inputVariables: ["schema", "question"],
});

export const COLUMN_ANALYSIS_PROMPT = new PromptTemplate({
  template: `
    You are a Database Schema Analyst.
    Your job is to identify EXACTLY which columns from the schema are required to answer the user's natural language question.

    Schema:
    {schema}

    Question:
    {question}

    Instructions:
    1. Analyze the question to determine ALL data points needed.
    2. Include columns for SELECT, WHERE/FILTER, and ORDER BY.
    3. Return a JSON object with "required_columns".

    Examples:
    Q: "Show me all users" (Schema: id, name, email) -> output: ["id", "name", "email"] (or just ["name", "email"] if implied)
    Q: "Show sales on 2023-01-01" (Schema: id, amount, date) -> output: ["amount", "date"] (Date is needed for filter!)
    Q: "Highest price items" (Schema: item, price) -> output: ["item", "price"] (Price needed for sort)

    Schema:
    {schema}

    Question:
    {question}

    Respond with ONLY this JSON format:
    {{
        "required_columns": ["column_name_1", "column_name_2"]
    }}
    `,
  inputVariables: ["schema", "question"],
});

export const GRAPH_ANALYSIS_PROMPT = new PromptTemplate({
  template: `
    You are a Data Analyst. Analyze the following graph data and provide a concise summary of the key insights.

    Graph Title: {title}
    
    Data:
    {data}

    Instructions:
    1. Identify the most significant trends, peaks, or outliers.
    2. Explain what this data signifies in simple terms.
    3. Keep the "Answer" short, professional, and actionable (2-3 sentences).

    Response:
    `,
  inputVariables: ["title", "data"],
});

export default SQL_GENERATION_PROMPT;
