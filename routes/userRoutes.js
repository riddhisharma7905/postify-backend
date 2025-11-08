import express from "express";
import { 
  getUserDashboard, 
  getUserById, 
  followUser,
  checkFollowStatus 
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/dashboard", authMiddleware, getUserDashboard);
router.get("/:id", getUserById);
router.post("/:id/follow", authMiddleware, followUser);
router.get("/:id/follow-status", authMiddleware, checkFollowStatus); // ✅ NEW

export default router;
