import express, { Request, Response } from "express";
import { SavedGraph } from "../models/SavedGraph";

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Save a graph to library
router.post(
  "/saved-graphs",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { title, content } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const savedGraph = new SavedGraph({
        userId,
        title: title || "Untitled Graph",
        content,
      });

      await savedGraph.save();
      res.json(savedGraph);
    } catch (error) {
      console.error("Error saving graph:", error);
      res.status(500).json({ error: "Failed to save graph" });
    }
  }
);

// Get all saved graphs
router.get(
  "/saved-graphs",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const graphs = await SavedGraph.find({ userId }).sort({ createdAt: -1 });
      res.json(graphs);
    } catch (error) {
      console.error("Error fetching saved graphs:", error);
      res.status(500).json({ error: "Failed to fetch graphs" });
    }
  }
);

// Delete a saved graph
router.delete(
  "/saved-graphs/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await SavedGraph.findOneAndDelete({ _id: id, userId });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting saved graph:", error);
      res.status(500).json({ error: "Failed to delete graph" });
    }
  }
);

export default router;
