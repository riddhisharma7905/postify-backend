import { User } from "../models/User.js";
import { Post } from "../models/Post.js";

export const getUserDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("followers", "name email")
      .populate("following", "name email");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      name: user.name,
      email: user.email,
      followers: user.followers,
      following: user.following,
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
      .populate("followers", "name email")
      .populate("following", "name email");

    res.status(200).json({
      message: isFollowing ? "Unfollowed" : "Followed",
      isFollowing: !isFollowing,
      followerCount: updatedTargetUser.followers.length,
      followingCount: updatedTargetUser.following.length,
      targetUser: updatedTargetUser,
    });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("name email followers following")
      .populate("followers", "name email")
      .populate("following", "name email");
    
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
