import mongoose, { isValidObjectId, mongo } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // DONE: toggle subscription

  /* Subscriber is the user logged in */
  const subscriber = req.user._id;

  /* If user is already subscribed, delete the particular record to unsubscribe */
  const response = await Subscription.deleteOne({
    $and: [{ subscriber }, { channel: channelId }],
  });

  /* User was not previously subscribed: Add a record to perform subscription */
  if (response.deletedCount !== 1) {
    const newSubscription = {
      subscriber: new mongoose.Types.ObjectId(subscriber),
      channel: new mongoose.Types.ObjectId(channelId),
    };
    await Subscription.create(newSubscription);

    return res.status(200).json(new ApiResponse(200, {}, "User Subscribed"));
  }

  return res.status(200).json(new ApiResponse(200, {}, "User Unsubscribed"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  /**
   * Match channel
   * Get subscribed users info from users collection
   * Project only the subscriber object
   * Replace root to flatten out [{subscriber: {...}}] -> to [{...}, {...}]
   * Group and add all objects to subscribers array
   * Add numberOfSubscribers field: Size of array
   * */
  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: new mongoose.Types.ObjectId(channelId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              email: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscriber: { $first: "$subscriber" },
      },
    },
    {
      $project: {
        subscriber: 1,
        _id: 0,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$subscriber",
      },
    },
    {
      $group: {
        _id: null,
        subscribers: {
          $push: "$$ROOT",
        },
      },
    },
    {
      $addFields: {
        numberOfSubcribers: { $size: "$subscribers" },
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscribers,
        "Subscriber List for channel Fetched Successfully"
      )
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  /**
   * Match subscriber Id
   * Get channels subscribed to  users collection
   * Project only the channel object
   * Replace root to flatten out [{channel: {...}}] -> to [{...}, {...}]
   * Group and add all objects to channels array
   * Add numberOfChannelsSubscribedTo field: Size of channels array
   * */
  const channelsSubscribedTo = await Subscription.aggregate([
    {
      $match: {
        subscriber: new mongoose.Types.ObjectId(subscriberId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              email: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        channel: { $first: "$channel" },
      },
    },
    {
      $project: {
        channel: 1,
        _id: 0,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$channel",
      },
    },
    {
      $group: {
        _id: null,
        channels: {
          $push: "$$ROOT",
        },
      },
    },
    {
      $addFields: {
        numberOfChannelsSubscribedTo: { $size: "$channels" },
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channelsSubscribedTo,
        "Channels Subscribed To Fetched Successfully"
      )
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
