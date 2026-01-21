import mongoose, { Document, Schema } from "mongoose";

export interface ISavedGraph extends Document {
  userId: string;
  title: string;
  content: {
    data: any[];
    chartType: string;
    xAxis: string;
    yAxis: string;
  };
  createdAt: Date;
}

const SavedGraphSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true },
    content: {
      data: { type: Array, required: true },
      chartType: { type: String, required: true },
      xAxis: { type: String, required: true },
      yAxis: { type: String, required: true },
    },
  },
  { timestamps: true }
);

export const SavedGraph = mongoose.model<ISavedGraph>(
  "SavedGraph",
  SavedGraphSchema
);
