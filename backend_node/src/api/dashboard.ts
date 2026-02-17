import express, { Request, Response } from "express";
import { Dashboard } from "../models/Dashboard";
import { Note } from "../models/Note";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Get Dashboard
router.get("/dashboard", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let dashboard = await Dashboard.findOne({ userId });

    if (!dashboard) {
      dashboard = new Dashboard({ userId, items: [] });
      await dashboard.save();
    }

    res.json(dashboard);
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// Save Dashboard Layout (Batch Update)
router.post(
  "/dashboard/save",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { items } = req.body; // Expects full array of items with updated layouts

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const dashboard = await Dashboard.findOneAndUpdate(
        { userId },
        { items }, // Replace items with new state (including positions)
        { new: true, upsert: true }
      );

      res.json(dashboard);
    } catch (error) {
      console.error("Error saving dashboard:", error);
      res.status(500).json({ error: "Failed to save dashboard" });
    }
  }
);

// Add Item
router.post(
  "/dashboard/item",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { type, title, content, layout } = req.body;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Prepare default layout
      // We'll place it at 0,Infinity which RGL usually handles by putting it at the bottom
      const newItem = {
        id: uuidv4(),
        type,
        title,
        content,
        layout: { x: 0, y: 0, w: 4, h: 4, i: uuidv4(), ...layout }, // Default size, override with provided layout
      };

      // Ensure IDs match for RGL
      newItem.layout.i = newItem.id;

      // Truncate data if it's too large to store directly in mongo document (optional safety)
      if (
        content?.data &&
        Array.isArray(content.data) &&
        content.data.length > 1000
      ) {
        content.data = content.data.slice(0, 1000);
      }

      // Find custom placement (simple: just add to end)
      const dashboard = await Dashboard.findOne({ userId });

      // Calculate next Y position
      let nextY = 0;
      if (dashboard && dashboard.items.length > 0) {
        const bottomItem = dashboard.items.reduce((max, item) => {
          const bottom = (item.layout.y || 0) + (item.layout.h || 0);
          return bottom > max ? bottom : max;
        }, 0);
        nextY = bottomItem;
      }
      newItem.layout.y = nextY;

      await Dashboard.findOneAndUpdate(
        { userId },
        { $push: { items: newItem } },
        { upsert: true }
      );

      res.json(newItem);
    } catch (error) {
      console.error("Error adding dashboard item:", error);
      res.status(500).json({ error: "Failed to add item" });
    }
  }
);

// Delete Item
router.delete(
  "/dashboard/item/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const dashboard = await Dashboard.findOne({ userId });
      if (dashboard) {
        const itemToDelete = dashboard.items.find((i: any) => i.id === id);

        // Cascading delete for Notes
        if (
          itemToDelete &&
          itemToDelete.type === "text" &&
          itemToDelete.content?.noteId
        ) {
          await Note.findByIdAndDelete(itemToDelete.content.noteId);
          console.log(
            `Cascading delete: Removed note ${itemToDelete.content.noteId}`
          );
        }

        // Now remove key from dashboard
        await Dashboard.findOneAndUpdate(
          { userId },
          { $pull: { items: { id } } }
        );
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting dashboard item:", error);
      res.status(500).json({ error: "Failed to delete item" });
    }
  }
);

export default router;
