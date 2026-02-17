import { Router, Request, Response } from "express";
import { UploadLog, QueryLog } from "../db/models";

const router = Router();

// Get aggregated sessions (grouped by upload)
router.get("/history/sessions", async (req: Request, res: Response) => {
  try {
    // 1. Get all uploads
    const uploads = await UploadLog.find({ userId: req.user.id }).sort({
      uploadDate: -1,
    });
    const sessions = [];

    for (const upload of uploads) {
      // 2. Get queries for this upload
      const queries = await QueryLog.find({ uploadId: upload._id }).sort({
        timestamp: 1,
      }); // Oldest first for chat history

      if (queries.length > 0) {
        sessions.push({
          upload,
          queries,
          lastActive: queries[queries.length - 1].timestamp,
        });
      }
    }

    // Sort sessions by most recent activity
    sessions.sort(
      (a, b) =>
        new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    );

    res.json(sessions);
  } catch (error) {
    console.error("Error fetching session history:", error);
    res.status(500).json({ error: "Failed to fetch session history" });
  }
});

// Delete a query log
router.delete("/history/query/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await QueryLog.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting query:", error);
    res.status(500).json({ error: "Failed to delete query" });
  }
});

// Delete an entire session (upload + queries)
router.delete(
  "/history/session/:uploadId",
  async (req: Request, res: Response) => {
    try {
      const { uploadId } = req.params;
      const fs = require("fs");

      // 1. Find the upload to get the file path
      const upload = await UploadLog.findById(uploadId);
      if (!upload) {
        res.status(404).json({ error: "Session not found" });
        return;
      }

      // 2. Delete the physical file if it exists
      if (upload.path && fs.existsSync(upload.path)) {
        try {
          fs.unlinkSync(upload.path);
          console.log(`Deleted file: ${upload.path}`);
        } catch (err) {
          console.error(`Failed to delete file ${upload.path}:`, err);
          // Continue with DB deletion even if file fails
        }
      }

      // Also check for .sqlite version if it was a CSVOriginally
      const potentialSqlitePath = upload.path + ".sqlite";
      if (fs.existsSync(potentialSqlitePath)) {
        try {
          fs.unlinkSync(potentialSqlitePath);
        } catch (ignore) {}
      }
      // Also check for master file if it was a multi-upload
      if (upload.path && upload.path.endsWith(".master.sqlite")) {
        // already covered by main path check likely, but good to be safe if naming schemes vary
      }

      // 3. Delete all queries associated with this upload
      await QueryLog.deleteMany({ uploadId: uploadId });

      // 4. Delete the upload record itself
      await UploadLog.findByIdAndDelete(uploadId);

      res.json({ success: true, message: "Session deleted successfully" });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  }
);

export default router;
