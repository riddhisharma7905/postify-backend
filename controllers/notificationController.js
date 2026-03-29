import { Notification } from "../models/Notification.js";

// ── SSE Client Registry ──────────────────────────────────────────────────────
// userId (string) → Set of SSE response objects
const sseClients = new Map();

function addSseClient(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
}

function removeSseClient(userId, res) {
  const set = sseClients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClients.delete(userId);
}

function pushToUser(userId, eventName, data) {
  const set = sseClients.get(userId.toString());
  if (!set || set.size === 0) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  set.forEach((res) => {
    try {
      res.write(payload);
    } catch (_) {}
  });
}

// ── SSE Stream Endpoint ──────────────────────────────────────────────────────
// GET /api/notifications/stream?token=<jwt>
export const streamNotifications = (req, res) => {
  const userId = req.user._id.toString();

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Initial ping so client knows connection is alive
  res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);

  addSseClient(userId, res);

  // Heartbeat every 20s to prevent proxy timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch (_) {}
  }, 20_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(userId, res);
  });
};

// ── REST Endpoints ───────────────────────────────────────────────────────────

// GET /api/notifications
export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate("sender", "name email")
      .populate("post", "title _id")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/notifications/unread-count
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/notifications/mark-all-read
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/notifications/:id/read
export const markOneRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Error marking read" });
  }
};

export const clearNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ recipient: req.user._id });
    console.log(`Cleared ${result.deletedCount} notifications for user ${req.user._id}`);
    res.json({ message: "All notifications cleared", count: result.deletedCount });
  } catch (err) {
    console.error("Clear notifications error:", err);
    res.status(500).json({ message: "Error clearing notifications" });
  }
};

// ── Internal Helper — called by postController & userController ──────────────
export const createNotification = async ({
  recipientId,
  senderId,
  type,
  postId = null,
}) => {
  // Never notify yourself
  if (recipientId.toString() === senderId.toString()) return;

  try {
    // Check for recent duplicate (same action within 30min) to avoid spam
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const existing = await Notification.findOne({
      recipient: recipientId,
      sender: senderId,
      type,
      post: postId || null,
      createdAt: { $gt: thirtyMinsAgo },
    });

    let notif;
    if (existing) {
      // Bump it to unread so they see it again
      notif = await Notification.findByIdAndUpdate(
        existing._id,
        { $set: { read: false, createdAt: new Date() } },
        { new: true }
      )
        .populate("sender", "name email")
        .populate("post", "title _id");
    } else {
      // Create new notification
      const created = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        type,
        post: postId || null,
        read: false,
      });
      notif = await Notification.findById(created._id)
        .populate("sender", "name email")
        .populate("post", "title _id");
    }

    // Push to SSE client if connected (real-time)
    if (notif) {
      pushToUser(recipientId, "notification", notif);
    }
  } catch (err) {
    console.warn("createNotification error:", err.message);
  }
};
