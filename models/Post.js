import mongoose from "mongoose";
import { commentSchema } from "./Comment.js"; 
const CATEGORIES = ["Technology", "Business", "Education", "Career", "Lifestyle", "Health", "Travel", "Others"];

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tags: { type: [String], default: [] },
  category: { type: String, enum: CATEGORIES, default: "Others" },
  image: { type: String, default: null },
  likes: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
  comments: { type: [commentSchema], default: [] },
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  scheduledAt: { type: Date, default: null },
});

export const Post = mongoose.model("Post", postSchema);
