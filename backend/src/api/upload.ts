import express, { Request, Response, Router } from "express";
import multer from "multer";
import path from "path";
import sqlite3 from "sqlite3";
import fs from "fs";
import { parse } from "csv-parse";
import { UploadLog } from "../db/models";
import { model } from "../llm/model";
import { HumanMessage } from "@langchain/core/messages";

const uploadRouter = Router();

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Use a timestamp to prevent collisions, but keep original name
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

const generateSmartTableName = async (
  originalName: string,
  headers: string[]
): Promise<string> => {
  try {
    console.log("Generating smart name for:", originalName);
    const prompt = `Given the filename "${originalName}" and headers "${headers
      .slice(0, 5)
      .join(
        ", "
      )}...", generate a concise, snake_case table name (max 50 chars). Do not use 'table_' prefix unless necessary. Return ONLY the name.`;
    const res = await model.invoke([new HumanMessage(prompt)]);
    let name = res.content.toString().trim();
    // Sanitize: remove code blocks, newlines, etc.
    name = name.replace(/```/g, "").replace(/\n/g, "").trim();
    name = name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();

    // Ensure it starts with letter? SQLite implies quoted tables can be anything, but let's be safe.
    if (!/^[a-z]/.test(name)) name = "t_" + name;

    if (name.length < 2) throw new Error("Name too short");
    return name;
  } catch (e) {
    console.error("Smart naming failed, using fallback:", e);
    return (
      "table_" +
      path
        .basename(originalName, path.extname(originalName))
        .replace(/[^a-zA-Z0-9_]/g, "_")
    );
  }
};

const processCsvToSqlite = (
  csvPath: string,
  dbPath: string,
  originalNameStr?: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log(`Processing CSV: ${csvPath} -> ${dbPath}`);

    const db = new sqlite3.Database(dbPath);
    const rows: any[] = [];

    fs.createReadStream(csvPath)
      .pipe(parse({ columns: true, trim: true }))
      .on("data", (row) => rows.push(row))
      .on("error", (err) => {
        console.error("CSV Parse Error:", err);
        db.close();
        reject(err);
      })
      .on("end", async () => {
        console.log(`CSV Parsed. Rows: ${rows.length}`);

        if (rows.length === 0) {
          db.close();
          return resolve();
        }

        const headers = Object.keys(rows[0]);

        // Smart Naming
        let tableName = `table_${Date.now()}`; // fallback default
        if (originalNameStr) {
          tableName = await generateSmartTableName(originalNameStr, headers);
        } else {
          const rawName = path
            .basename(csvPath, path.extname(csvPath))
            .replace(/[^a-zA-Z0-9_]/g, "_");
          tableName = `table_${rawName}`;
        }

        // Ensure uniqueness? SQLite handles `IF NOT EXISTS` but we want to fail or overwrite?
        // Code used to do `CREATE TABLE IF NOT EXISTS`.
        // If smart name collides (e.g. upload same file twice), it will append to existing table or do nothing?
        // The previous code: `CREATE TABLE IF NOT EXISTS`. `INSERT INTO`.
        // If table exists, schema might mismatch.
        // For now, let's assume unique enough or user intends append.
        // Actually, if table exists, `CREATE` is skipped. `INSERT` happens.

        console.log(`Creating table: ${tableName}`);

        const types = headers.map((header) =>
          rows.every((row) => row[header] !== "" && !isNaN(Number(row[header])))
            ? "REAL"
            : "TEXT"
        );

        const createTableSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${headers
          .map((h, i) => `"${h}" ${types[i]}`)
          .join(", ")});`;

        const placeholders = headers.map(() => "?").join(",");
        const insertSql = `INSERT INTO "${tableName}" VALUES (${placeholders})`;

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          db.run(createTableSql);

          const stmt = db.prepare(insertSql);

          for (const row of rows) {
            stmt.run(Object.values(row));
          }

          stmt.finalize((err) => {
            if (err) console.error("Finalize Error:", err);

            db.run("COMMIT", (commitErr) => {
              if (commitErr) console.error("Commit Error:", commitErr);

              db.close(() => {
                console.log(`SQLite DB updated with table ${tableName}`);
                resolve();
              });
            });
          });
        });
      });
  });
};

const performSmartCleaning = async (dbPath: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    console.log("Starting Smart Cleaning...");
    const db = new sqlite3.Database(dbPath);

    // 1. Get Schema & Sample Data for context
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      [],
      async (err, tables: any[]) => {
        if (err || !tables || tables.length === 0) {
          db.close();
          return resolve();
        }

        try {
          // Clean the last added table (most relevant for single upload)
          const tableName = tables[tables.length - 1].name;
          console.log("Cleaning table:", tableName);

          db.all(
            `SELECT * FROM "${tableName}" LIMIT 5`,
            [],
            async (err, rows) => {
              if (err || !rows || rows.length === 0) {
                db.close();
                return resolve();
              }

              const headers = Object.keys(rows[0] as object);
              const sampleJson = JSON.stringify(rows);

              const prompt = `
I have a SQLite table named "${tableName}" with columns: ${headers.join(", ")}.
Here are 5 sample rows:
${sampleJson}

Generate a SQL script to CLEAN this data. Focus on:
1. Trimming whitespace from text columns.
2. Converting empty strings '' to NULL where appropriate.
3. Standardizing Dates: If you see dates like '01/01/2023', convert them to 'YYYY-MM-DD'.
4. Fixing obvious typos in categorical columns if evident.

Return ONLY the raw SQL queries (UPDATE statements). Separated by semicolon (;). Do NOT return markdown or explanation.
`;
              const result = await model.invoke([new HumanMessage(prompt)]);
              let sql = result.content.toString();
              sql = sql
                .replace(/```sql/g, "")
                .replace(/```/g, "")
                .trim();

              if (!sql) {
                console.log("No cleaning SQL generated");
                db.close();
                return resolve();
              }

              console.log("Executing Cleaning SQL:\n", sql);

              db.exec(sql, (execErr) => {
                if (execErr) console.error("Cleaning Exec Error:", execErr);
                else console.log("Cleaning complete.");
                db.close();
                resolve();
              });
            }
          );
        } catch (e) {
          console.error("Smart Cleaning Failed:", e);
          db.close();
          resolve(); // Don't fail the upload just because cleaning failed
        }
      }
    );
  });
};

const getDatabaseState = (
  dbPath: string
): Promise<{ schema: string; databaseState: Record<string, any> }> => {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });

    const schemaQuery =
      "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL";

    db.all(schemaQuery, [], (err, rows: any[]) => {
      if (err) {
        db.close();
        return reject(err);
      }

      const schema = rows.map((row) => row.sql).join(";\n\n");
      const tablesQuery =
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';";

      db.all(tablesQuery, [], (tableErr, tableRows: any[]) => {
        if (tableErr) {
          db.close();
          return reject(tableErr);
        }

        const databaseState: Record<string, any[]> = {};
        let tablesProcessed = 0;
        const totalTables = tableRows.length;

        if (totalTables === 0) {
          db.close();
          return resolve({ schema, databaseState });
        }

        tableRows.forEach((table) => {
          const tableName = table.name;
          db.all(
            `SELECT * FROM "${tableName}" LIMIT 1`,
            [],
            (dataErr, dataRows) => {
              db.get(
                `SELECT COUNT(*) as count FROM "${tableName}"`,
                [],
                (countErr, countRow: any) => {
                  if (!dataErr && !countErr) {
                    databaseState[tableName] = {
                      rows: dataRows,
                      total: countRow.count,
                    } as any;
                  } else {
                    console.error(
                      `Error fetching data for ${tableName}:`,
                      dataErr || countErr
                    );
                    databaseState[tableName] = { rows: [], total: 0 } as any;
                  }

                  tablesProcessed++;
                  if (tablesProcessed === totalTables) {
                    db.close();
                    resolve({ schema, databaseState });
                  }
                }
              );
            }
          );
        });
      });
    });
  });
};

uploadRouter.post(
  "/upload-db",
  upload.array("database", 10), // Allow up to 10 files
  async (req: Request, res: Response): Promise<void> => {
    console.log("Upload request received");
    const clean = req.query.clean === "true";

    // Normalize req.files to always be an array
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      console.error("No file uploaded");
      res.status(400).json({ status: "error", message: "No file uploaded" });
      return;
    }

    console.log(`Files uploaded: ${files.length}. Cleaning Enabled: ${clean}`);

    try {
      // CASE 1: Single File Upload (Preserve existing behavior logic mostly)
      if (files.length === 1) {
        const file = files[0];
        let dbPath = file.path;
        const originalName = file.originalname;

        if (originalName.toLowerCase().endsWith(".csv")) {
          const sqlitePath = dbPath + ".sqlite";
          console.log("Starting Single CSV conversion...");
          await processCsvToSqlite(dbPath, sqlitePath, originalName);

          if (clean) await performSmartCleaning(sqlitePath);

          if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); // Cleanup CSV
          dbPath = sqlitePath;
        }

        // Log upload
        const newUpload = new UploadLog({
          filename: file.filename,
          originalName: originalName,
          path: dbPath,
          userId: req.user.id,
        });
        const savedUpload = await newUpload.save();
        const uploadLogId = savedUpload._id as unknown as string;

        // Get State
        const { schema, databaseState } = await getDatabaseState(dbPath);
        res.json({
          status: "success",
          message: "Database uploaded successfully",
          schema,
          filename: file.filename,
          path: dbPath,
          databaseState,
          uploadId: uploadLogId,
        });
        return;
      }

      // CASE 2: Multiple Files (Only support Multiple CSVs for now)
      // Check if all are CSVs
      const allCsv = files.every((f) =>
        f.originalname.toLowerCase().endsWith(".csv")
      );
      if (!allCsv) {
        // cleanup all files
        files.forEach((f) => {
          if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
        });
        res.status(400).json({
          status: "error",
          message: "Multi-file upload currently only supports multiple CSVs.",
        });
        return;
      }

      // Create a master SQLite file based on the first file's ID or timestamp
      const primaryFile = files[0];
      const masterDbPath = primaryFile.path + ".master.sqlite"; // Distinct name

      console.log(`Merging ${files.length} CSVs into ${masterDbPath}`);

      // Process each CSV into the SAME master DB path
      for (const file of files) {
        await processCsvToSqlite(file.path, masterDbPath, file.originalname);
        // Cleanup individual CSV
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      }

      if (clean) await performSmartCleaning(masterDbPath);

      // Log the Master Upload
      const newUpload = new UploadLog({
        filename: `merged-${Date.now()}.sqlite`,
        originalName: `Merged Dataset (${files.length} CSVs)`,
        path: masterDbPath,
        userId: req.user.id,
      });
      const savedUpload = await newUpload.save();

      const { schema, databaseState } = await getDatabaseState(masterDbPath);

      res.json({
        status: "success",
        message: `Successfully merged ${files.length} CSV files.`,
        schema,
        filename: newUpload.filename,
        path: masterDbPath,
        databaseState,
        uploadId: savedUpload._id as unknown as string,
      });
    } catch (err: any) {
      console.error("Upload Error:", err);
      // Attempt cleanup
      if (req.files)
        (req.files as Express.Multer.File[]).forEach((f) => {
          try {
            if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
          } catch (e) {}
        });
      res.status(500).json({
        status: "error",
        message: "Failed to process upload",
        error: err.message,
      });
    }
  }
);

uploadRouter.post(
  "/append",
  upload.single("database"),
  async (req: Request, res: Response): Promise<void> => {
    console.log("Append request received");
    const clean = req.query.clean === "true";
    const uploadId = req.body.uploadId;

    if (!uploadId) {
      res.status(400).json({ status: "error", message: "Missing uploadId" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ status: "error", message: "No file uploaded" });
      return;
    }

    let existingUpload;
    try {
      existingUpload = await UploadLog.findById(uploadId);
    } catch (e) {
      console.error("Error finding upload:", e);
      res
        .status(500)
        .json({ status: "error", message: "Database lookup failed" });
      return;
    }

    if (!existingUpload || !existingUpload.path) {
      res
        .status(404)
        .json({ status: "error", message: "Upload session not found" });
      return;
    }

    const dbPath = existingUpload.path;
    console.log(`Appending to existing DB at: ${dbPath}`);

    if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
      res.status(400).json({
        status: "error",
        message: "Only CSV appending is supported currently",
      });
      return;
    }

    try {
      await processCsvToSqlite(req.file.path, dbPath, req.file.originalname);
      // Cleanup temp CSV
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
        console.log("Temp append CSV deleted:", req.file.path);
      }

      if (clean) await performSmartCleaning(dbPath);
    } catch (err: any) {
      console.error("Failed to append CSV:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to append data",
        error: err.message,
      });
      return;
    }

    try {
      const { schema, databaseState } = await getDatabaseState(dbPath);
      res.json({
        status: "success",
        message: "Table added successfully",
        schema,
        databaseState,
        uploadId,
      });
    } catch (err: any) {
      console.error("Failed to extract database state:", err);
      res.status(500).json({
        status: "error",
        message: "Failed to read updated database state",
        error: err.message,
      });
    }
  }
);

export default uploadRouter;
