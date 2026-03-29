import express from "express";
import { 
  getUserDashboard, 
  getUserById, 
  followUser,
  checkFollowStatus,
  updateUserProfile,
  pinPost,
  getSuggestedUsers
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/suggested", getSuggestedUsers);
router.get("/dashboard", authMiddleware, getUserDashboard);
router.get("/:id", getUserById);
router.post("/:id/follow", authMiddleware, followUser);
router.get("/:id/follow-status", authMiddleware, checkFollowStatus);
router.put("/profile", authMiddleware, updateUserProfile);
router.post("/pin/:postId", authMiddleware, pinPost);

export default router;
