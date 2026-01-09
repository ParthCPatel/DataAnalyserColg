import { Router, Request, Response } from "express";
import { UploadLog } from "../db/models";
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

const router = Router();

interface DeleteTableRequest {
  uploadId: string;
  tableName: string;
}

router.delete("/table", async (req: Request, res: Response): Promise<void> => {
  const { uploadId, tableName } = req.body as DeleteTableRequest;

  console.log(
    `[DeleteTable] Request received for table: ${tableName}, uploadId: ${uploadId}`
  );

  if (!uploadId || !tableName) {
    res.status(400).json({ error: "Missing uploadId or tableName" });
    return;
  }

  try {
    const upload = await UploadLog.findById(uploadId);
    if (!upload) {
      console.error("[DeleteTable] Upload session not found");
      res.status(404).json({ error: "Upload not found" });
      return;
    }

    let dbPath = upload.path;
    // Handle legacy case
    if (dbPath.endsWith(".csv")) {
      const sqlitePath = dbPath + ".sqlite";
      if (fs.existsSync(sqlitePath)) dbPath = sqlitePath;
    }

    if (!fs.existsSync(dbPath)) {
      console.error(`[DeleteTable] DB file not found at ${dbPath}`);
      res.status(404).json({ error: "Database file not found" });
      return;
    }

    console.log(`[DeleteTable] Opening DB at ${dbPath}`);

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
      if (err) {
        console.error("[DeleteTable] Error opening DB:", err);
        // We don't send response here, we let the run callback handle failure if possible,
        // or we check state. But if open fails, likely run will fail too.
        // Ideally we return here if we could cancel subsequent calls, but sqlite3 is async.
        // We rely on the fact that if open fails, 'run' callback will be called with error.
      }
    });

    // Use serialize to ensure sequential execution
    db.serialize(() => {
      const dropQuery = `DROP TABLE IF EXISTS "${tableName}"`;
      console.log(`[DeleteTable] Executing: ${dropQuery}`);

      db.run(dropQuery, function (err) {
        // 'this' context in function has 'changes' property if needed
        db.close();
        if (err) {
          console.error(
            `[DeleteTable] Error dropping table ${tableName}:`,
            err
          );
          if (!res.headersSent) {
            res
              .status(500)
              .json({ error: "Failed to delete table: " + err.message });
          }
          return;
        }

        console.log(`[DeleteTable] Dropped table ${tableName}`);
        if (!res.headersSent) {
          res.json({ message: "Table deleted successfully", tableName });
        }
      });
    });
  } catch (error: any) {
    console.error("[DeleteTable] Unexpected API Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

export default router;
