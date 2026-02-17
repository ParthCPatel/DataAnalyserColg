import { Router, Request, Response } from "express";
import { User } from "../models/User";
import jwt from "jsonwebtoken";
import { z } from "zod";

const router = Router();
const JWT_SECRET =
  process.env.JWT_SECRET || "5f8e2a9c1b4d3e7g6h9i2j5k8l1m4n7o2p3q5r8";

// Validation Schemas
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Signup
router.post("/signup", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      res
        .status(400)
        .json({ message: "Invalid input", errors: result.error.issues });
      return;
    }

    const { email, password } = result.data;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      res.status(400).json({ message: "Email already registered" });
      return;
    }

    const user = new User({ email, password });
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      status: "success",
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ message: "Invalid input" });
      return;
    }

    const { email, password } = result.data;
    const user = await User.findOne({ email });

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    // @ts-ignore - method added in schema
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      status: "success",
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
