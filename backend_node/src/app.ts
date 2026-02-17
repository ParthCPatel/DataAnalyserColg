import express from "express";
import cors from "cors";
import { connectDB } from "./db/mongo";
import sandboxRouter from "./api/sandbox";
import uploadRouter from "./api/upload";
import historyRouter from "./api/history";
import dataRouter from "./api/data";
import analyzeRouter from "./api/analyze";
import analysisRouter from "./api/analysis"; // Added this line
import authRouter from "./api/auth";
import dashboardRouter from "./api/dashboard";
import notesRouter from "./api/notes";
import savedGraphsRouter from "./api/savedGraphs";
import { authenticate } from "./middleware/auth";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Connect to MongoDB
connectDB();

// Public Routes
console.log("Mounting /api/auth");
app.use("/api/auth", authRouter);

// Protected Routes
app.use("/api", authenticate, uploadRouter);
app.use("/api", authenticate, sandboxRouter);
app.use("/api", authenticate, historyRouter);
app.use("/api", authenticate, dataRouter);
app.use("/api", authenticate, analyzeRouter);
app.use("/api/analysis", authenticate, analysisRouter);
app.use("/api", authenticate, dashboardRouter);
app.use("/api", authenticate, notesRouter);
app.use("/api", authenticate, savedGraphsRouter);

export default app;
