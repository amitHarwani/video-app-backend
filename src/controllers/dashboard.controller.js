import mongoose, { mongo } from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // DONE: Get the channel stats like total video views, total subscribers, total videos, total likes etc.

  /* Total number of videos and total number of views */
  const videoStats = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $group: {
        _id: "$owner",
        numberOfVideos: {
          $sum: 1,
        },
        numberOfViews: {
          $sum: "$views",
        },
      },
    },
  ]);

  /* Total number of subscribers */
  const totalNumberOfSubcribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $group: {
        _id: "$channel",
        numberOfSubscribers: {
          $sum: 1,
        },
      },
    },
  ]);

  /* Total video, tweet and comment likes */
  const totalLikes = await Like.aggregate([
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "videoOwner",
        pipeline: [
          {
            $match: {
              owner: new mongoose.Types.ObjectId(req.user?._id),
            },
          },
          {
            $project: {
              owner: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "tweet",
        foreignField: "_id",
        as: "tweetOwner",
        pipeline: [
          {
            $match: {
              owner: new mongoose.Types.ObjectId(req.user?._id),
            },
          },
          {
            $project: {
              owner: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "comment",
        foreignField: "_id",
        as: "commentOwner",
        pipeline: [
          {
            $match: {
              owner: new mongoose.Types.ObjectId(req.user?._id),
            },
          },
          {
            $project: {
              owner: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        videoOwner: { $first: "$videoOwner" },
      },
    },
    {
      $addFields: {
        videoOwner: "$videoOwner.owner",
      },
    },
    {
      $addFields: {
        tweetOwner: { $first: "$tweetOwner" },
      },
    },
    {
      $addFields: {
        tweetOwner: "$tweetOwner.owner",
      },
    },
    {
      $addFields: {
        commentOwner: { $first: "$commentOwner" },
      },
    },
    {
      $addFields: {
        commentOwner: "$commentOwner.owner",
      },
    },
    {
      $group: {
        _id: {
          video: "$videoOwner",
          comment: "$commentOwner",
          tweet: "$tweetOwner",
        },
        likes: { $sum: 1 },
      },
    },
    {
      $addFields: {
        "_id.tweetLikes": {
          $cond: {
            if: "$_id.tweet",
            then: "$likes",
            else: "$$REMOVE",
          },
        },
        "_id.commentLikes": {
          $cond: {
            if: "$_id.comment",
            then: "$likes",
            else: "$$REMOVE",
          },
        },
        "_id.videoLikes": {
          $cond: {
            if: "$_id.video",
            then: "$likes",
            else: "$$REMOVE",
          },
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: "$_id",
      },
    },
    {
      $group: {
        _id: 0,
        merged: {
          $push: "$$ROOT",
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: "$merged",
        },
      },
    },
  ]);


  return res.status(200).json(
    new ApiResponse(200, {
      totalVideos: videoStats?.[0]?.numberOfVideos || 0,
      totalVideoViews: videoStats?.[0]?.numberOfViews || 0,
      totalNumberOfSubscribers: totalNumberOfSubcribers?.[0]?.numberOfSubscribers || 0,
      totalVideoLikes: totalLikes?.[0]?.videoLikes || 0,
      totalCommentLikes: totalLikes?.[0]?.commentLikes || 0,
      tweetLikes: totalLikes?.[0]?.tweetLikes || 0
    },
    "Channel Stats fetched successfully"
    )
  )
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // DONE: Get all the videos uploaded by the channel

  const videoList = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(req.user?._id)
      }
    },
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
              avatar: 1
            }
          }
        ]
      }
    },
    {
      $addFields: {
        owner: {$first: "$owner"}
      }
    }
  ]);

  return res.status(200).json(new ApiResponse(200, videoList, "Videos of a channel fetched successfully"));
});

export { getChannelStats, getChannelVideos };
