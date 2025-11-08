import { Post } from "../models/Post.js";
import fetch from "node-fetch";


export const recommendPosts = async (req, res) => {
  try {
    const natural = (await import("natural")).default;

    if (!req.params.id || req.params.id === "undefined") {
      return res.status(400).json({ message: "Invalid post id" });
    }

    const current = await Post.findById(req.params.id).populate("author", "name email");
    if (!current) return res.status(404).json({ message: "Post not found" });

    const all = await Post.find({ _id: { $ne: current._id } })
      .populate("author", "name email")
      .select("title content tags views author");

    if (all.length === 0) return res.json([]);

    const TfIdf = natural.TfIdf;
    const tfidf = new TfIdf();

    all.forEach((p) => {
      const text = `${p.title || ""} ${p.content || ""} ${(p.tags || []).join(" ")}`;
      tfidf.addDocument(text);
    });

    const currentText = `${current.title || ""} ${current.content || ""} ${(current.tags || []).join(" ")}`;
    const words = currentText.split(/\s+/).filter(w => w.length > 2); 

    const scores = all.map((p, i) => {
      let score = 0;
   
      words.forEach((w) => {
        score += tfidf.tfidf(w, i);
      });
      if (current.tags && current.tags.length > 0) {
        const overlap = (p.tags || []).filter((t) => 
          current.tags.some(ct => ct.toLowerCase() === t.toLowerCase())
        ).length;
        score += overlap * 1.5; 
      }

      return { post: p, score };
    });

    scores.sort((a, b) => b.score - a.score);
    const recommended = scores
      .filter(s => s.score > 0.5)
      .slice(0, 4)
      .map(s => s.post);

    if (recommended.length === 0 && current.tags && current.tags.length > 0) {
      const categoryPosts = await Post.find({
        _id: { $ne: current._id },
        tags: { $in: current.tags },
      })
        .populate("author", "name email")
        .sort({ views: -1 })
        .limit(4);
      
      return res.json(categoryPosts);
    }
    if (recommended.length === 0) {
      const trending = await Post.find({ _id: { $ne: current._id } })
        .populate("author", "name email")
        .sort({ views: -1, createdAt: -1 })
        .limit(4);
      return res.json(trending);
    }

    res.json(recommended);
  } catch (err) {
    console.error("Error in recommendPosts:", err);
    res.status(500).json({ message: "Error generating recommendations" });
  }
};


export const getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", "name email")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
};

export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("author", "name email")
      .populate("comments.user", "name email");

    if (!post) return res.status(404).json({ message: "Post not found" });

    post.views = (post.views || 0) + 1;
    await post.save();

    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createPost = async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (!title || !content)
      return res.status(400).json({ message: "Title and content are required" });
    const formattedTags = Array.isArray(tags)
      ? tags.map(t => t.trim().replace(/\s+/g, "").toLowerCase())
      : [];
    const post = new Post({
      title,
      content,
      tags,
      author: req.user._id,
    });

    await post.save();
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

    res.json(updated);
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

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    let isToxic = false;
    try {
      const response = await fetch("http://127.0.0.1:5002/predict", {
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

    post.comments.push({ user: userId, text, isToxic });
    await post.save();

    const updated = await Post.findById(post._id)
      .populate("author", "name email")
      .populate("comments.user", "name email");

    res.status(201).json(updated);
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

    res.json(updatedPost);
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const searchPosts = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);
    const normalized = query.replace(/\s+/g, "").toLowerCase();

    const posts = await Post.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { content: { $regex: query, $options: "i" } },
        {
          tags: {
            $elemMatch: { $regex: new RegExp(normalized, "i") },
          },
        },
      ],
    })
      .populate("author", "name email")
      .sort({ views: -1, createdAt: -1 });

    res.json(posts);
  } catch (err) {
    console.error("Error searching posts:", err);
    res.status(500).json({ message: "Failed to search posts" });
  }
};


export const getExplorePosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", "name email")
      .sort({ views: -1, createdAt: -1 })
      .limit(6);

    res.json(posts);
  } catch (err) {
    console.error("Error fetching explore posts:", err);
    res.status(500).json({ message: "Failed to fetch explore posts" });
  }
};



export const getMyPosts = async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user._id }).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: "Error fetching user's posts" });
  }
};
