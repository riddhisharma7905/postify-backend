import { User } from "../models/User.js";
import { Post } from "../models/Post.js";
import { createNotification } from "./notificationController.js";

export const getUserDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("followers", "name email profileImage")
      .populate("following", "name email profileImage");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      name: user.name,
      email: user.email,
      birthdate: user.birthdate,
      sex: user.sex,
      bio: user.bio,
      profileImage: user.profileImage,
      coverImage: user.coverImage,
      phoneNumber: user.phoneNumber,
      followers: user.followers,
      following: user.following,
      pinnedPostId: user.pinnedPostId,
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const followUser = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const targetUserId = req.params.id;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetUserId);

    if (!targetUser) return res.status(404).json({ message: "User not found" });
    const isFollowing = currentUser.following.some(
      (id) => id.toString() === targetUserId
    );

    if (isFollowing) {
      currentUser.following = currentUser.following.filter(
        (id) => id.toString() !== targetUserId
      );
      targetUser.followers = targetUser.followers.filter(
        (id) => id.toString() !== currentUserId
      );
    } else {
      if (!currentUser.following.some(id => id.toString() === targetUserId)) {
        currentUser.following.push(targetUserId);
      }
      if (!targetUser.followers.some(id => id.toString() === currentUserId)) {
        targetUser.followers.push(currentUserId);
      }
    }

    await currentUser.save({ validateBeforeSave: true });
    await targetUser.save({ validateBeforeSave: true });
    const updatedTargetUser = await User.findById(targetUserId)
      .select("-password")
      .populate("followers", "name email profileImage")
      .populate("following", "name email profileImage");

    res.status(200).json({
      message: isFollowing ? "Unfollowed" : "Followed",
      isFollowing: !isFollowing,
      followerCount: updatedTargetUser.followers.length,
      followingCount: updatedTargetUser.following.length,
      targetUser: updatedTargetUser,
    });

    // Fire follow notification (only when following, not unfollowing)
    if (!isFollowing) {
      await createNotification({
        recipientId: targetUserId,
        senderId: currentUserId,
        type: "follow",
        postId: null,
      });
    }
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("name email bio profileImage coverImage followers following pinnedPostId createdAt")
      .populate("followers", "name email profileImage")
      .populate("following", "name email profileImage");
    
    if (!user) return res.status(404).json({ message: "User not found" });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const checkFollowStatus = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const targetUserId = req.params.id;

    const currentUser = await User.findById(currentUserId);
    const isFollowing = currentUser.following.some(
      (id) => id.toString() === targetUserId
    );

    res.json({ isFollowing });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { name, email, birthdate, sex, bio, phoneNumber, profileImage, coverImage } = req.body;
    const currentUser = await User.findById(req.user._id);
    
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    // Handle email update with uniqueness check
    if (email && email !== currentUser.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }
      currentUser.email = email;
    }

    if (name) currentUser.name = name;
    if (birthdate !== undefined) currentUser.birthdate = birthdate;
    if (sex !== undefined) currentUser.sex = sex;
    if (bio !== undefined) currentUser.bio = bio;
    if (profileImage !== undefined) currentUser.profileImage = profileImage;
    if (coverImage !== undefined) currentUser.coverImage = coverImage;
    if (phoneNumber !== undefined) currentUser.phoneNumber = phoneNumber;

    await currentUser.save();
    
    const updatedUser = await User.findById(currentUser._id)
      .select("-password")
      .populate("followers following", "name email profileImage");
      
    res.json(updatedUser);
  } catch (err) {
    console.error("Profile update error detail:", err);
    res.status(500).json({ message: "Failed to update profile: " + err.message });
  }
};

export const pinPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Toggle: if already pinned the same post, unpin it
    if (user.pinnedPostId?.toString() === postId) {
      user.pinnedPostId = null;
      await user.save();
      return res.json({ message: "Post unpinned", pinnedPostId: null });
    }

    // Verify the post belongs to this user
    const post = await Post.findOne({ _id: postId, author: userId });
    if (!post) return res.status(403).json({ message: "You can only pin your own posts" });

    user.pinnedPostId = postId;
    await user.save();
    res.json({ message: "Post pinned", pinnedPostId: postId });
  } catch (err) {
    res.status(500).json({ message: "Failed to pin post" });
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    const currentUserId = req.user?._id;
    const { authorId } = req.query;

    let suggested;

    if (authorId) {
      // 1. Find categories of posts by this author
      const authorPosts = await Post.find({ author: authorId }).distinct("category");
      
      if (authorPosts && authorPosts.length > 0) {
        // 2. Find other users who wrote posts in these categories
        suggested = await Post.find({ 
            category: { $in: authorPosts }, 
            author: { $nin: [authorId, currentUserId].filter(Boolean) } 
          })
          .distinct("author");
        
        // 3. Populate selected authors
        suggested = await User.find({ _id: { $in: suggested } })
          .select("name email profileImage bio followers")
          .limit(5);
      }
    }

    // Default: fallback to global suggestions if no authorId or no category matches
    if (!suggested || suggested.length === 0) {
      suggested = await User.find({ _id: { $ne: currentUserId || authorId } })
        .select("name email profileImage bio followers")
        .sort({ "followers.length": -1 })
        .limit(5);
    }

    res.json(suggested);
  } catch (err) {
    console.error("Suggestions error:", err);
    res.status(500).json({ message: "Failed to fetch suggestions" });
  }
};

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      console.warn("Upload attempt without file");
      return res.status(400).json({ message: "No file uploaded" });
    }
    console.log("File uploaded successfully to Cloudinary:", req.file.path);
    res.json({ url: req.file.path });
  } catch (err) {
    console.error("Cloudinary Upload Error:", err);
    res.status(500).json({ message: "Upload failed: " + err.message });
  }
};
