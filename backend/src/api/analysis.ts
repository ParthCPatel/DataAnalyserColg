import express from "express";
import { model } from "../llm/model";
import { GRAPH_ANALYSIS_PROMPT } from "../llm/prompts";

const router = express.Router();

router.post("/analyze-graph", async (req, res) => {
  try {
    const { title, data } = req.body;

    if (!data) {
      res.status(400).json({ error: "Data is required" });
      return;
    }

    const prompt = await GRAPH_ANALYSIS_PROMPT.format({
      title: title || "Untitled Graph",
      data: JSON.stringify(data.slice(0, 50)), // Limit data context
    });

    const result = await model.invoke(prompt);
    // ChatGoogleGenerativeAI returns structured object, content is the string response
    const response = result.content;

    res.json({ analysis: response });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze graph" });
  }
});

export default router;
