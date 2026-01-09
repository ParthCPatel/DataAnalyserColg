import { Router, Request, Response } from "express";
import { SandboxDB } from "../db/sandbox";
import { app as agentGraph } from "../graph/workflow";
import { QueryLog } from "../db/models";
import mongoose from "mongoose";
import { GraphLogger } from "../graph/logger";

const router = Router();

// Properly type the expected request body
interface SandboxRequest {
  schema: string;
  question?: string; // Made optional for state fetching
  dbFilePath?: string;
  uploadId?: string;
  restrictedColumns?: string[];
}

router.post("/sandbox", async (req: Request, res: Response): Promise<void> => {
  let db: SandboxDB | null = null;

  try {
    const { question, schema, dbFilePath, uploadId, restrictedColumns } =
      req.body as SandboxRequest;

    console.log(
      `[SandboxAPI] Request Body - QuesLen: ${question?.length}, RestrictedCols:`,
      restrictedColumns
    );

    // Allow fetching state without question
    const isStateFetch = !question;

    if (!question && !isStateFetch) {
      res.status(400).json({ error: "Missing 'question' in request body." });
      return;
    }

    console.log("--- New Sandbox Request ---");

    // 1. Initialize DB (In-memory or from File)
    console.log("Initializing SandboxDB with path:", dbFilePath);

    let finalDbPath = dbFilePath;
    // Fix for legacy uploads where CSV path was saved instead of SQLite path
    if (dbFilePath && dbFilePath.endsWith(".csv")) {
      const sqlitePath = dbFilePath + ".sqlite";
      // We assume the conversion happened if it's a CSV upload
      console.log(
        `Detailed Log: Detected CSV path ${dbFilePath}, switching to ${sqlitePath}`
      );
      finalDbPath = sqlitePath;
    }

    // PATH FIX: Check if file exists, if not, try resolving from local uploads directory
    if (finalDbPath) {
      const fs = require("fs");
      const path = require("path");
      if (!fs.existsSync(finalDbPath)) {
        const filename = path.basename(finalDbPath);
        const localPath = path.join(__dirname, "../../uploads", filename);
        if (fs.existsSync(localPath)) {
          console.log(
            `[SandboxAPI] Path mismatch detected. Switching from ${finalDbPath} to local: ${localPath}`
          );
          finalDbPath = localPath;
        } else {
          console.warn(
            `[SandboxAPI] Warning: DB file not found at ${finalDbPath} OR local ${localPath}`
          );
        }
      }
    }

    db = new SandboxDB(finalDbPath);
    await db.init();
    console.log("SandboxDB Initialized");

    // 4. Logic to fetch actual table data separated by table name
    const tablesQuery =
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";
    const tables = await db.query(tablesQuery);
    console.log(
      `[SandboxAPI] DB initialized. Found ${tables.length} tables:`,
      tables.map((t) => `'${t.name}'`).join(", ")
    );

    // Dynamic Schema Generation (Robustness Fix)
    // If schema is missing (or empty) in request, generate it from the DB.
    let activeSchema = schema;
    if (!activeSchema || activeSchema.trim().length === 0) {
      console.log(
        "[SandboxAPI] Schema missing in request, generating from DB..."
      );
      const tableSchemas: string[] = [];
      for (const t of tables) {
        const createSql = await db.query(
          `SELECT sql FROM sqlite_master WHERE name='${t.name}'`
        );
        if (createSql && createSql.length > 0 && createSql[0].sql) {
          tableSchemas.push(createSql[0].sql);
        }
      }
      activeSchema = tableSchemas.join("\n");
      console.log(
        `[SandboxAPI] Generated schema of length: ${activeSchema.length}`
      );
    }

    const databaseState: Record<string, any> = {};

    for (const table of tables) {
      const tableName = table.name;
      try {
        const countRes = await db.query(
          `SELECT COUNT(*) as count FROM "${tableName}"`
        );
        const total = countRes[0].count;
        const rows = await db.query(`SELECT * FROM "${tableName}" LIMIT 1`);

        databaseState[tableName] = {
          rows: rows,
          total: total,
        };
      } catch (err) {
        console.warn(`Could not fetch rows for table ${tableName}`, err);
      }
    }

    // 5. Run Agent
    console.log(`Executing Question: ${question}`);
    console.log(
      `Schema available: ${!!schema}, Schema length: ${
        schema ? schema.length : 0
      }`
    );

    // --- DEBUG: Check Table Counts ---
    console.log("--- DEBUG: Verifying Table Data ---");
    for (const table of tables) {
      try {
        const countRes = await db.query(
          `SELECT COUNT(*) as count FROM "${table.name}"`
        );
        console.log(`Table '${table.name}' has ${countRes[0].count} rows.`);
      } catch (err) {
        console.error(`Failed to count rows for ${table.name}:`, err);
      }
    }
    console.log("-----------------------------------");

    if (question) {
      const logger = new GraphLogger();

      const result = await agentGraph.invoke(
        { question, schema: activeSchema, db, restrictedColumns },
        { callbacks: [logger] }
      );

      console.log("Agent Graph execution completed", result);
      const logs = logger.getLogs();

      // --- TITLE GENERATION ---
      let title = question;
      try {
        // Determine model to use (assuming model export from ../llm/model exists)
        const { model } = require("../llm/model");
        const titlePrompt = `Summarize the following SQL question into a short, clean, human-readable title (3-6 words). Ignore technical context or data dumps. Question: "${question}"`;
        const titleRes = await model.invoke([["user", titlePrompt]]);
        title = titleRes.content.toString().replace(/"/g, "").trim();
      } catch (err) {
        console.error("Failed to generate title:", err);
        // Fallback to truncating question if it's too long
        if (title.length > 50) title = title.substring(0, 47) + "...";
      }

      // --- LOGGING TO MONGODB ---
      let queryId: string | undefined;
      try {
        const newQuery = new QueryLog({
          question: question,
          title: title, // Save generated title
          generatedSQL: result.sql,
          resultSummary: result.result ? JSON.stringify(result.result) : "[]",
          uploadId: uploadId
            ? new mongoose.Types.ObjectId(uploadId as string)
            : undefined,
          userId: req.user?.id,
        });
        await newQuery.save();
        queryId = newQuery._id.toString();
        console.log("Query logged to MongoDB");
      } catch (logErr) {
        console.error("Failed to log query to MongoDB:", logErr);
      }
      // 6. Response
      res.json({
        status: "success",
        queryId: queryId, // Return ID for frontend deletion
        generatedSQL: result.sql,
        answer: result.result,
        feedback: result.feedback,
        validation: result.valid,
        databaseState, // Return the structured data
        logs: logs, // Return the captured logs from CallbackHandler
      });
    } else {
      // State Fetch Only Response
      res.json({
        status: "success",
        message: "Database state fetched",
        databaseState,
      });
    }
  } catch (error: any) {
    console.error("Sandbox Error Stack:", error.stack);
    console.error("Sandbox Error Message:", error.message);
    console.error(
      "Full Error Object:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    res
      .status(500)
      .json({
        error: "Internal Server Error",
        details: error.message,
        stack: error.stack,
      });
  } finally {
    if (db) {
      db.close();
    }
  }
});

export default router;
