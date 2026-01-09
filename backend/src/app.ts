import express from "express";
import cors from "cors";
import { connectDB } from "./db/mongo";
import sandboxRouter from "./api/sandbox";
import uploadRouter from "./api/upload";
import historyRouter from "./api/history";
import dataRouter from "./api/data";
import analyzeRouter from "./api/analyze";
import authRouter from "./api/auth";
import { authenticate } from "./middleware/auth";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Connect to MongoDB
connectDB();

// Public Routes
app.use("/api/auth", authRouter);

// Protected Routes
app.use("/api", authenticate, uploadRouter);
app.use("/api", authenticate, sandboxRouter);
app.use("/api", authenticate, historyRouter);
app.use("/api", authenticate, dataRouter);
app.use("/api", authenticate, analyzeRouter);

export default app;
