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
