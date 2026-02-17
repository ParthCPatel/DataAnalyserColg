import mongoose, { Schema, Document } from "mongoose";

// Interface for Upload Log
export interface IUploadLog extends Document {
  filename: string;
  originalName: string;
  path: string;
  uploadDate: Date;
  userId: string;
}

// Interface for Query Log
export interface IQueryLog extends Document {
  question: string;
  title?: string; // New field for AI-generated title
  generatedSQL: string;
  resultSummary: string; // Storing a summary or stringified result
  timestamp: Date;
  uploadId?: mongoose.Types.ObjectId; // Optional link to the upload used
  userId?: string;
}

const UploadLogSchema: Schema = new Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  path: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now },
  userId: { type: String, required: true },
});

const QueryLogSchema: Schema = new Schema({
  question: { type: String, required: true },
  title: { type: String }, // New field
  generatedSQL: { type: String, required: true },
  resultSummary: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  uploadId: { type: Schema.Types.ObjectId, ref: "UploadLog" },
  userId: { type: String },
});

export const UploadLog = mongoose.model<IUploadLog>(
  "UploadLog",
  UploadLogSchema,
  "Uploads"
);
export const QueryLog = mongoose.model<IQueryLog>(
  "QueryLog",
  QueryLogSchema,
  "Queries"
);
