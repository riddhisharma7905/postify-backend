import mongoose from "mongoose";

const replySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: { type: String, required: true },
  isToxic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: { type: String, required: true },
  isToxic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  replies: { type: [replySchema], default: [] },
});

export const Comment = mongoose.model("Comment", commentSchema);
