import express from "express";
import { 
  getUserDashboard, 
  getUserById, 
  followUser, 
  checkFollowStatus, 
  updateUserProfile, 
  pinPost, 
  getSuggestedUsers, 
  uploadImage,
  deleteUserImage 
} from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { upload } from "../utils/cloudinaryConfig.js";

const router = express.Router();

router.get("/suggested", getSuggestedUsers);
router.get("/dashboard", authMiddleware, getUserDashboard);
router.get("/:id", getUserById);
router.post("/:id/follow", authMiddleware, followUser);
router.get("/:id/follow-status", authMiddleware, checkFollowStatus);
router.put("/profile", authMiddleware, updateUserProfile);
router.post("/pin/:postId", authMiddleware, pinPost);

// Upload endpoint
router.post("/upload", authMiddleware, upload.single("image"), uploadImage);
router.delete("/image", authMiddleware, deleteUserImage);

export default router;
