import { sql_maker } from "../tools/sql_maker";
import { validator_tool } from "../tools/validator.tool";
import { sql_executor } from "../tools/sql_executor";
import { GraphState } from "./state";
import { check_relevance_tool } from "../tools/relevance_checker";

export const generate_sql_node = async (state: typeof GraphState.State) => {
  const { question, feedback, schema, restrictedColumns } = state;
  // Determine if the question is answerable by the schema
  const isRelevant = await check_relevance_tool(question, schema);
  if (!isRelevant) {
    console.warn(
      "Relevance Check Failed: Question deemed unrelated to schema. Proceeding anyway..."
    );
    // throw new Error("Invalid Request: The question is unrelated to the provided database schema.");
  }

  let debugInfo = "";
  // --- Relaxed Column Selection ---
  // We simply pass the restrictedColumns (now acting as "Selected Columns")
  // to the sql_maker to guide the SELECT clause.

  let sqlOrError = await sql_maker(
    question,
    schema,
    feedback || "",
    restrictedColumns || []
  );

  // Check if result is the JSON error (legacy check, just in case)
  try {
    const parsed = JSON.parse(sqlOrError);
    if (parsed.error && parsed.missingColumns) {
      // Should not happen now, but keeping for safety
      return {
        sql: sqlOrError,
        iterations: (state.iterations || 0) + 1,
      };
    }
  } catch (e) {
    // Not JSON, normal SQL
  }

  // Check if result is the JSON error
  try {
    const parsed = JSON.parse(sqlOrError);
    if (parsed.error && parsed.missingColumns) {
      // It's a missing column error.
      // We can throw or separate it. Ideally, we return it as "result" or a special state to stop execution.
      // But strict graph expects "sql".
      // Let's wrap it in a special "ERROR:" string if simple, or better:
      // The graph expects a string for 'sql'. If we return JSON, the validator might fail.
      // Let's assume valid=false and pass this as feedback?
      // Or better, we need the frontend to receive this.

      // Hack: If it's strict error, return it as the "sql" value but marked.
      // Actually, we can return it as is. The validator will fail syntax check (it's JSON not SQL).
      // But we want to fail gracefully.
      return {
        sql: sqlOrError, // Pass JSON string as SQL
        iterations: (state.iterations || 0) + 1,
      };
    }
  } catch (e) {
    // Not JSON, so it's likely SQL. Continue.
  }

  return {
    sql: sqlOrError,
    iterations: (state.iterations || 0) + 1,
  };
};

export const validate_sql_node = async (state: typeof GraphState.State) => {
  const { sql, schema } = state;

  // --- SECURITY CHECK (Proposed Restriction) ---

  // const forbiddenKeywords = ["DELETE", "UPDATE", "ALTER", "DROP", "TRUNCATE", "INSERT"];
  // const upperSQL = sql.toUpperCase();
  // if (forbiddenKeywords.some(keyword => upperSQL.includes(keyword))) {
  //     return {
  //         valid: false,
  //         feedback: "Invalid Query: Modifying the database (DELETE, UPDATE, ALTER, etc.) is not allowed. Read-only queries only."
  //     };
  // }

  // ---------------------------------------------
  const validation = await validator_tool(sql, schema);
  return {
    valid: validation.valid,
    feedback: validation.reasoning,
  };
};

export const execute_sql_node = async (state: typeof GraphState.State) => {
  const { sql, db } = state;
  try {
    const result = await sql_executor(sql, db);
    return { result };
  } catch (error: any) {
    return {
      valid: false,
      feedback: `Runtime Error: ${error.message}. Please fix the SQL.`,
      iterations: (state.iterations || 0) + 1,
    };
  }
};
