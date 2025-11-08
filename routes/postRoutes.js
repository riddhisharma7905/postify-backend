import express from "express";
import {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  likePost,
  getMyPosts,
  addComment,
  deleteComment,
  recommendPosts,
  getExplorePosts,
  searchPosts,
} from "../controllers/postController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/search", searchPosts);
router.get("/explore", getExplorePosts);
router.get("/user/me", authMiddleware, getMyPosts);

router.get("/author/:id", async (req, res) => {
  try {
    const { Post } = await import("../models/Post.js");
    const posts = await Post.find({ author: req.params.id })
      .populate("author", "name email")
      .sort({ createdAt: -1 });

    if (!posts || posts.length === 0) {
      return res.status(404).json({ message: "No posts found for this author" });
    }

    res.json(posts);
  } catch (err) {
    console.error("Error fetching posts by author:", err);
    res.status(500).json({ message: "Error fetching author posts" });
  }
});

router.get("/:id/recommendations", recommendPosts);
router.get("/:id", getPost);

router.post("/", authMiddleware, createPost);
router.put("/:id", authMiddleware, updatePost);
router.delete("/:id", authMiddleware, deletePost);
router.post("/:id/like", authMiddleware, likePost);
router.post("/:id/comment", authMiddleware, addComment);
router.delete("/:postId/comment/:commentId", authMiddleware, deleteComment);

router.get("/", getPosts);

export default router;
