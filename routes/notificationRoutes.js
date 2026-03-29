import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
  streamNotifications,
  clearNotifications,
} from "../controllers/notificationController.js";
import { authMiddleware, authMiddlewareQuery } from "../middleware/authMiddleware.js";

const router = express.Router();

// SSE — token via query param (?token=...) because EventSource doesn't support headers
router.get("/stream", authMiddlewareQuery, streamNotifications);

// REST endpoints — standard Bearer auth
router.get("/unread-count", authMiddleware, getUnreadCount);
router.get("/", authMiddleware, getNotifications);
router.put("/mark-all-read", authMiddleware, markAllRead);
router.put("/:id/read", authMiddleware, markOneRead);
router.delete("/clear-all", authMiddleware, clearNotifications); // <--- Using more explicit name

export default router;
