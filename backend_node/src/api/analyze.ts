import express, { Request, Response, Router } from "express";
import sqlite3 from "sqlite3";
import { UploadLog } from "../db/models";
import { model } from "../llm/model";
import { HumanMessage } from "@langchain/core/messages";

const analyzeRouter = Router();

analyzeRouter.post(
  "/analyze-table",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { uploadId, tableName, tableNames } = req.body;

      // Support both single "tableName" (legacy/direct) and "tableNames" array
      const targets: string[] = tableNames || (tableName ? [tableName] : []);

      if (!uploadId || targets.length === 0) {
        res
          .status(400)
          .json({
            status: "error",
            message: "Missing uploadId or table names",
          });
        return;
      }

      // 1. Get Database Path
      const uploadLog = await UploadLog.findById(uploadId);
      if (!uploadLog || !uploadLog.path) {
        res
          .status(404)
          .json({ status: "error", message: "Upload session not found" });
        return;
      }

      const dbPath = uploadLog.path;
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

      // Helper functions
      const getSchema = (t: string) =>
        new Promise<any[]>((resolve, reject) => {
          db.all(`PRAGMA table_info("${t}")`, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

      const getRows = (t: string) =>
        new Promise<any[]>((resolve, reject) => {
          db.all(`SELECT * FROM "${t}" LIMIT 20`, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          });
        });

      // 2. Fetch Data for ALL targets
      const contextData = [];
      for (const t of targets) {
        try {
          const [columns, rows] = await Promise.all([getSchema(t), getRows(t)]);
          contextData.push({
            tableName: t,
            columns: columns.map((c: any) => c.name),
            rows: rows,
          });
        } catch (e) {
          console.error(`Error fetching data for ${t}:`, e);
        }
      }

      db.close();

      if (contextData.length === 0) {
        res.json({
          status: "success",
          analysis: {
            summary: "No data found.",
            trends: [],
            anomalies: [],
            questions: [],
          },
        });
        return;
      }

      // 3. Construct LLM Prompt
      const isMultiTable = contextData.length > 1;

      let dataPrompt = "";
      contextData.forEach((d) => {
        dataPrompt += `
            === TABLE: ${d.tableName} ===
            Columns: ${JSON.stringify(d.columns)}
            Sample Data (first 20 rows):
            ${JSON.stringify(d.rows)}
            `;
      });

      const prompt = `
        Act as a Senior Data Analyst. Analyze the following local database table(s).
        ${dataPrompt}
        
        ${
          isMultiTable
            ? "Since there are multiple tables, you MUST identify potential relationships (Foreign Keys), join opportunities, or correlations BETWEEN them."
            : "Analyze the distributions and patterns within this table."
        }

        Provide a "Deep Dive" analysis in strictly valid JSON format with the following structure:
        {
            "summary": "Brief 1-2 sentence overview. ${
              isMultiTable ? "Mention how these tables might relate." : ""
            }",
            "trends": ["List 2-4 key trends, patterns, or correlations ${
              isMultiTable ? "across these tables" : "in the data"
            }."],
            "anomalies": ["List 1-2 potential outliers or quality issues."],
            "questions": ["List 3 complex questions that ${
              isMultiTable
                ? "require joining these tables"
                : "reveal deep insights"
            }."]
        }
        
        Do not output markdown code blocks. Just the raw JSON string.
        `;

      // 4. Call LLM
      const response = await model.invoke([new HumanMessage(prompt)]);
      let content = response.content.toString();

      // Cleanup content
      content = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let analysis;
      try {
        analysis = JSON.parse(content);
      } catch (e) {
        console.error("Failed to parse LLM analysis:", content);
        analysis = {
          summary: "Analysis generated but format was invalid.",
          raw: content,
          trends: [],
          anomalies: [],
          questions: [],
        };
      }

      res.json({
        status: "success",
        analysis,
      });
    } catch (error: any) {
      console.error("Analysis Error:", error);
      res.status(500).json({ status: "error", message: error.message });
    }
  }
);

export default analyzeRouter;
