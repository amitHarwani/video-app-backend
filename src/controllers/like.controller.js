import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Tweet } from "../models/tweet.model.js";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //DONE: toggle like on video

  /* Validate if video exists */
  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  /* Check if the user has already liked this video */
  const existingLikeOnVideo = await Like.findOne({
    video: videoId,
    likedBy: req.user?._id,
  });

  /* Video is already liked by the user: Remove the like */
  if (existingLikeOnVideo) {
    const deletedLike = await Like.findByIdAndDelete(existingLikeOnVideo._id);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { deletedLike: deletedLike },
          "Like removed successfully"
        )
      );
  }

  /* Adding a like */
  const newLike = await Like.create({
    video: new mongoose.Types.ObjectId(videoId),
    likedBy: new mongoose.Types.ObjectId(req.user?._id),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, newLike, "Like added successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  //DONE: toggle like on comment

  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const existingLikeOnComment = await Like.findOne({
    comment: commentId,
    likedBy: req.user?._id,
  });

  if (existingLikeOnComment) {
    const deletedLike = await Like.findByIdAndDelete(existingLikeOnComment._id);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { deletedLike: deletedLike },
          "Like removed successfully"
        )
      );
  }

  const newLike = await Like.create({
    comment: new mongoose.Types.ObjectId(commentId),
    likedBy: new mongoose.Types.ObjectId(req.user?._id),
  });
  return res
    .status(201)
    .json(new ApiResponse(201, newLike, "Like added successfully"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  //DONE: toggle like on tweet

  const tweet = await Tweet.findById(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  const existingLikeOnTweet = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user?._id,
  });

  if (existingLikeOnTweet) {
    const deletedLike = await Like.findByIdAndDelete(existingLikeOnTweet._id);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { deletedLike: deletedLike },
          "Like removed successfully"
        )
      );
  }

  const newLike = await Like.create({
    tweet: new mongoose.Types.ObjectId(tweetId),
    likedBy: new mongoose.Types.ObjectId(req.user?._id),
  });
  return res
    .status(201)
    .json(new ApiResponse(201, newLike, "Like added successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //DONE: get all liked videos

  /**
   * Match: video is not null
   * group by video id, and include numberOfLikes: sum of the group
   * lookup for video and video owner info
   */
  const likedVideos = await Like.aggregate([
    {
      $match: {
        video: { $ne: null },
      },
    },
    {
      $group: {
        _id: "$video",
        numberOfLikes: {
          $sum: 1,
        },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    fullName: 1,
                    email: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: { $first: "$owner" },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        video: {
          $first: "$video",
        },
      },
    },
    {
      $addFields: {
        "video.numberOfLikes": "$numberOfLikes",
      },
    },
    {
      $replaceRoot: {
        newRoot: "$video",
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };
