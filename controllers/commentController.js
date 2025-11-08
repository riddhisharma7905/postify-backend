import { Comment } from "../models/Comment.js";
import axios from "axios";

export const addComment = async (req, res) => {
  try {
    const { content } = req.body;

    const response = await axios.post("http://127.0.0.1:5002/predict", {
      content: content,
    });

    const isToxic = response.data.is_toxic;

    if (isToxic) {
      return res.status(400).json({
        message: "Comment flagged as toxic. Not allowed.",
      });
    }

    const comment = new Comment({
      content,
      author: req.user,
      post: req.params.id,
      isToxic,
    });

    await comment.save();
    res.status(201).json(comment);
  } catch (err) {
    console.error("Error in addComment:", err.message);
    res.status(500).json({ message: "Error adding comment" });
  }
};

export const getComments = async (req, res) => {
  try {
    const comments = await Comment.find({ post: req.params.id })
      .populate("author", "username")
      .sort({ createdAt: -1 });

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
