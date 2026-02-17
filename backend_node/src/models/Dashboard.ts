import mongoose, { Document, Schema } from "mongoose";

export interface IDashboardItem {
  id: string;
  type: "graph" | "text" | "stat";
  title: string;
  content: any; // Flexible content structure
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
    i?: string;
  };
}

export interface IDashboard extends Document {
  userId: string;
  items: IDashboardItem[];
  createdAt: Date;
  updatedAt: Date;
}

const DashboardItemSchema: Schema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["graph", "text", "stat"], required: true },
  title: { type: String, required: true },
  content: { type: Schema.Types.Mixed, default: {} },
  layout: {
    type: new Schema(
      {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        w: { type: Number, required: true },
        h: { type: Number, required: true },
        i: { type: String },
        minW: { type: Number },
        minH: { type: Number },
        maxW: { type: Number },
        maxH: { type: Number },
      },
      { _id: false }
    ),
    required: true,
  },
});

const DashboardSchema: Schema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    items: [DashboardItemSchema],
  },
  { timestamps: true }
);

export const Dashboard = mongoose.model<IDashboard>(
  "Dashboard",
  DashboardSchema
);
