import mongoose from "mongoose";

export const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: { type: String, required: true },
  isToxic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const Comment = mongoose.model("Comment", commentSchema);
