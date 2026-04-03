import { Post } from "../models/Post.js";
import fetch from "node-fetch";
import { createNotification } from "./notificationController.js";
import { User } from "../models/User.js";


export const recommendPosts = async (req, res) => {
  try {
    if (!req.params.id || req.params.id === "undefined") {
      return res.status(400).json({ message: "Invalid post id" });
    }

    const current = await Post.findById(req.params.id).populate("author", "name email");
    if (!current) return res.status(404).json({ message: "Post not found" });

    const now = new Date();

    const pipeline = [
      {
        $match: {
          _id: { $ne: current._id },
          $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }, { scheduledAt: { $lte: now } }]
        }
      },
      {
        $addFields: {
          tagOverlap: {
            $size: {
              $setIntersection: [
                {
                  $map: {
                    input: { $ifNull: ["$tags", []] },
                    as: "tag",
                    in: { $toLower: "$$tag" }
                  }
                },
                current.tags ? current.tags.map(t => t.toLowerCase()) : []
              ]
            }
          },
          categoryMatch: {
            $cond: [{ $eq: ["$category", current.category] }, 1, 0]
          }
        }
      },
      {
        $addFields: {
          score: {
            $add: [
              { $multiply: ["$tagOverlap", 2] },
              { $multiply: ["$categoryMatch", 3] }
            ]
          }
        }
      },
      { $sort: { score: -1, views: -1, createdAt: -1 } },
      { $limit: 4 }
    ];

    const recommended = await Post.aggregate(pipeline);

    // Populate the author data after aggregation
    await Post.populate(recommended, { path: "author", select: "name email" });

    res.json(recommended);
  } catch (err) {
    console.error("Error in recommendPosts:", err);
    res.status(500).json({ message: "Error generating recommendations" });
  }
};


export const getPosts = async (req, res) => {
  try {
    const now = new Date();
    const posts = await Post.find({
      $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }, { scheduledAt: { $lte: now } }],
    })
      .populate("author", "name email")
      .sort({ createdAt: -1 });

    const postsWithCount = posts.map(p => {
      const obj = p.toObject();
      obj.commentCount = (p.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
      return obj;
    });

    res.json(postsWithCount);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "name email")
      .populate("comments.user", "name email _id")
      .populate("comments.replies.user", "name email _id");

    if (!post) return res.status(404).json({ message: "Post not found" });

    const now = new Date();
    if (post.scheduledAt && post.scheduledAt > now) {
      // Check if it's the author
      const userId = req.headers['x-user-id']; // We'll pass this or use auth middleware
      if (post.author._id.toString() !== userId) {
         return res.status(403).json({ message: "This post is scheduled for later." });
      }
    }

    const obj = post.toObject();
    obj.commentCount = (post.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const incrementViewCount = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Simple view counting
    post.views = (post.views || 0) + 1;
    await post.save();

    res.json({ views: post.views });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const { title, content, tags, scheduledAt, category, image } = req.body;
    if (!title || !content)
      return res.status(400).json({ message: "Title and content are required" });

    let scheduledDate = null;
    if (scheduledAt) {
      scheduledDate = new Date(scheduledAt);
      const now = new Date();
      const maxDate = new Date();
      maxDate.setDate(now.getDate() + 3);

      if (scheduledDate < now) {
        return res.status(400).json({ message: "Scheduled date cannot be in the past" });
      }
      if (scheduledDate > maxDate) {
        return res.status(400).json({ message: "You can only schedule posts up to 3 days in advance" });
      }
    }

    const post = new Post({
      title,
      content,
      tags: Array.isArray(tags) ? tags : [],
      category: category || "Others",
      image: image || null,
      author: req.user._id,
      scheduledAt: scheduledDate,
    });

    await post.save();

    // Notify all followers about the new post
    const author = await User.findById(req.user._id).select("followers");
    if (author && author.followers.length > 0) {
      const notifyPromises = author.followers.map((followerId) =>
        createNotification({
          recipientId: followerId,
          senderId: req.user._id,
          type: "new_post",
          postId: post._id,
        })
      );
      await Promise.allSettled(notifyPromises);
    }

    res.status(201).json({ message: "Post created successfully", post });
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: "Failed to create post" });
  }
};


export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Unauthorized" });

    post.title = req.body.title || post.title;
    post.content = req.body.content || post.content;
    if (req.body.tags !== undefined) post.tags = Array.isArray(req.body.tags) ? req.body.tags : post.tags;
    if (req.body.category) post.category = req.body.category;
    if (req.body.image !== undefined) post.image = req.body.image;

    await post.save();
    res.json({ message: "Post updated successfully", post });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.author.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Unauthorized" });

    await post.deleteOne();
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const likePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!Array.isArray(post.likes)) post.likes = [];

    const index = post.likes.findIndex((id) => id.toString() === userId.toString());
    if (index === -1) post.likes.push(userId);
    else post.likes.splice(index, 1);

    await post.save();
    const updated = await Post.findById(post._id)
      .populate("author", "name email")
      .populate("comments.user", "name email");

    const updatedWithCount = updated.toObject();
    updatedWithCount.commentCount = (updated.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

    // Fire like notification (only when liking, not unliking)
    const wasLiked = index === -1;
    if (wasLiked) {
      await createNotification({
        recipientId: updated.author._id,
        senderId: userId,
        type: "like",
        postId: post._id,
      });
    }

    res.json(updatedWithCount);
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const userId = req.user._id;
    if (!text) return res.status(400).json({ message: "Comment text required" });

    // 1. Toxicity check upfront (long-running)
    let isToxic = false;
    try {
      const mlUrl = process.env.ML_URL || "https://postify-backend-1.onrender.com";
      const response = await fetch(`${mlUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await response.json();
      isToxic = data.is_toxic;
    } catch (e) {
      console.warn("ML API failed, skipping toxicity check.");
    }

    if (isToxic) {
      return res
        .status(400)
        .json({ message: "Your comment violates our community guidelines. Please keep it respectful." });
    }

    // 2. Atomic push (prevents VersionError)
    const updated = await Post.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { user: userId, text, isToxic } } },
      { new: true }
    )
      .populate("author", "name email")
      .populate("comments.user", "name email");

    if (!updated) return res.status(404).json({ message: "Post not found" });

    const updatedWithCount = updated.toObject();
    updatedWithCount.commentCount = (updated.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);

    // Fire comment notification
    await createNotification({
      recipientId: updated.author._id,
      senderId: userId,
      type: "comment",
      postId: updated._id,
    });

    res.status(201).json(updatedWithCount);
  } catch (err) {
    console.error("Add Comment Error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    if (comment.user.toString() !== userId.toString())
      return res.status(403).json({ message: "Not authorized" });

    comment.deleteOne();
    await post.save();

    const updatedPost = await Post.findById(postId)
      .populate("author", "name")
      .populate("comments.user", "name");

    const postWithCount = updatedPost.toObject();
    postWithCount.commentCount = (updatedPost.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
    res.json(postWithCount);
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const searchPosts = async (req, res) => {
  try {
    const { query, category } = req.query;
    if (!query && !category) return res.json([]);

    const now = new Date();
    const filters = [
      { $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }, { scheduledAt: { $lte: now } }] }
    ];

    // Strict tag-only search: normalize query and compare against lowercased tags
    if (query) {
      const cleanQuery = query.trim().replace(/^#/, "").toLowerCase();
      // Use aggregation-style approach: match where any tag lowercased equals the query
      filters.push({
        $expr: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ["$tags", []] },
                  as: "tag",
                  cond: { $eq: [{ $toLower: "$$tag" }, cleanQuery] }
                }
              }
            },
            0
          ]
        }
      });
    }

    if (category && category !== "All") {
      filters.push({ category });
    }

    const posts = await Post.find({ $and: filters })
      .populate("author", "name email")
      .sort({ views: -1, createdAt: -1 });

    const postsWithCount = posts.map(p => {
      const obj = p.toObject();
      obj.commentCount = (p.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
      return obj;
    });

    res.json(postsWithCount);
  } catch (err) {
    console.error("Error searching posts:", err);
    res.status(500).json({ message: "Failed to search posts" });
  }
};


export const getExplorePosts = async (req, res) => {
  try {
    const now = new Date();
    const { category } = req.query;

    const filter = {
      $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }, { scheduledAt: { $lte: now } }],
    };

    if (category && category !== "All") {
      filter.category = category;
    }

    const posts = await Post.find(filter)
      .populate("author", "name email")
      .sort({ views: -1, createdAt: -1 })
      .limit(50);

    const postsWithCount = posts.map(p => {
      const obj = p.toObject();
      obj.commentCount = (p.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
      return obj;
    });

    res.json(postsWithCount);
  } catch (err) {
    console.error("Error fetching explore posts:", err);
    res.status(500).json({ message: "Failed to fetch explore posts" });
  }
};



export const getMyPosts = async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user._id }).sort({ createdAt: -1 });
    const postsWithCount = posts.map(p => {
      const obj = p.toObject();
      obj.commentCount = (p.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
      return obj;
    });
    res.json(postsWithCount);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user's posts" });
  }
};

export const getPostsLikedByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();
    const posts = await Post.find({
      likes: userId,
      $or: [{ scheduledAt: { $exists: false } }, { scheduledAt: null }, { scheduledAt: { $lte: now } }]
    })
      .populate("author", "name email")
      .sort({ createdAt: -1 });
    
    const postsWithCount = posts.map(p => {
      const obj = p.toObject();
      obj.commentCount = (p.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
      return obj;
    });

    res.json(postsWithCount);
  } catch (err) {
    res.status(500).json({ message: "Error fetching liked posts" });
  }
};

// ────────────────────────────────────────────────────────────────
// Comment Replies
// ────────────────────────────────────────────────────────────────

export const addReply = async (req, res) => {
  try {
    const { id: postId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text?.trim()) return res.status(400).json({ message: "Reply text required" });

    // 1. Toxicity check upfront
    let isToxic = false;
    try {
      const mlUrl = process.env.ML_URL || "https://postify-backend-1.onrender.com";
      const response = await fetch(`${mlUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await response.json();
      isToxic = data.is_toxic;
    } catch (e) {
      console.warn("ML API unavailable for reply check.");
    }

    if (isToxic) {
      return res.status(400).json({ message: "Your reply violates our community guidelines." });
    }

    // 2. Atomic nested push into comments array mapping by commentId
    const updated = await Post.findOneAndUpdate(
      { _id: postId, "comments._id": commentId },
      { $push: { "comments.$.replies": { user: userId, text, isToxic } } },
      { new: true }
    )
      .populate("author", "name email")
      .populate("comments.user", "name email _id")
      .populate("comments.replies.user", "name email _id");

    if (!updated) return res.status(404).json({ message: "Post or Comment not found" });

    const updatedWithCount = updated.toObject();
    updatedWithCount.commentCount = (updated.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
    res.status(201).json(updatedWithCount);

    // ── FIRE NOTIFICATIONS ──────────────────────────────────────────────────
    // 1. Notify the original commenter (recipient of the reply)
    const originalComment = updated.comments.id(commentId);
    if (originalComment && originalComment.user) {
      const originalCommenterId = originalComment.user._id;
      if (originalCommenterId.toString() !== userId.toString()) {
        await createNotification({
          recipientId: originalCommenterId,
          senderId: userId,
          type: "reply",
          postId: updated._id,
        });
      }

      // 2. Notify the post author (if different from replier and original commenter)
      const postAuthorId = updated.author._id;
      if (
        postAuthorId.toString() !== userId.toString() &&
        postAuthorId.toString() !== originalCommenterId.toString()
      ) {
        await createNotification({
          recipientId: postAuthorId,
          senderId: userId,
          type: "comment", // generalized since it's someone else's conversation on their post
          postId: updated._id,
        });
      }
    }
  } catch (err) {
    console.error("Add reply error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteReply = async (req, res) => {
  try {
    const { id: postId, commentId, replyId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });
    if (reply.user.toString() !== userId.toString())
      return res.status(403).json({ message: "Not authorized" });

    reply.deleteOne();
    await post.save();

    const updated = await Post.findById(postId)
      .populate("author", "name email")
      .populate("comments.user", "name email _id")
      .populate("comments.replies.user", "name email _id");

    const updatedWithCount = updated.toObject();
    updatedWithCount.commentCount = (updated.comments || []).reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0);
    res.json(updatedWithCount);
  } catch (err) {
    console.error("Delete reply error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const uploadPostImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    // Cloudinary URL is stored in req.file.path
    res.json({ url: req.file.path });
  } catch (err) {
    res.status(500).json({ message: "Upload failed: " + err.message });
  }
};
