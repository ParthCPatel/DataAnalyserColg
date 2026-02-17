import mongoose, { Document, Schema } from "mongoose";

export interface INote extends Document {
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema: Schema = new Schema(
  {
    userId: { type: String, required: true },
    content: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Note = mongoose.model<INote>("Note", NoteSchema);
