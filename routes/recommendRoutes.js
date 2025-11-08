import express from "express";
import { recommendPosts } from "../controllers/postController.js";

const router = express.Router();
router.get("/:id/recommendations", recommendPosts);

export default router;
