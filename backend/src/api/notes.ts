import express, { Request, Response } from "express";
import { Note } from "../models/Note";

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Create a new note
router.post("/notes", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const note = new Note({
      userId,
      content: content || "",
    });

    await note.save();
    res.json(note);
  } catch (error) {
    console.error("Error creating note:", error);
    res.status(500).json({ error: "Failed to create note" });
  }
});

// Get a specific note
router.get("/notes/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const note = await Note.findOne({ _id: id, userId });
    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    res.json(note);
  } catch (error) {
    console.error("Error fetching note:", error);
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// Update a note
router.put("/notes/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const note = await Note.findOneAndUpdate(
      { _id: id, userId },
      { content },
      { new: true }
    );

    if (!note) {
      res.status(404).json({ error: "Note not found" });
      return;
    }

    res.json(note);
  } catch (error) {
    console.error("Error updating note:", error);
    res.status(500).json({ error: "Failed to update note" });
  }
});

// Delete a note
router.delete(
  "/notes/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await Note.findOneAndDelete({ _id: id, userId });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  }
);

export default router;
