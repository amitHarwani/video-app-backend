import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";

/* Returns an array to be used as aggregation pipeline to get comments */
const getCommentAggregationPipeline = (matchObject) => {
  /**
   * Gets the comments according to the matchObject criteria passed
   * Populates the owner field with user info
   * Populate video field with video info and the videos owner info
   */

  return [
    {
      $match: matchObject,
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
              fullName: 1,
              email: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: { owner: { $first: "$owner" } },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
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
            $addFields: { owner: { $first: "$owner" } },
          },
        ],
      },
    },
    {
      $addFields: { video: { $first: "$video" } },
    },
  ];
};

const getVideoComments = asyncHandler(async (req, res) => {
  //DONE: get all comments for a video
  const { videoId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  page = Number(page);
  limit = Number(limit);

  /* Validating if page and limit passed are numbers */
  if (isNaN(page) || isNaN(limit)) {
    throw new ApiError(400, "Invalid page & limit passed");
  }

  /* Comments Aggregation Pipeline */
  const aggregate = Comment.aggregate(
    getCommentAggregationPipeline({
      video: new mongoose.Types.ObjectId(videoId),
    })
  );

  /* Pagination */
  const comments = await Comment.aggregatePaginate(aggregate, {
    page,
    limit,
    customLabels: { docs: "comments", totalDocs: "totalComments" },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));
});

const addComment = asyncHandler(async (req, res) => {
  // DONE: add a comment to a video
  const { videoId } = req.params;
  const { comment } = req.body;

  /* Validate if vide exists */
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video Not Found");
  }

  /* Validate if video is published */
  if (!video.isPublished) {
    throw new ApiError(400, "Cannot add comment to an unpublished video");
  }

  /* Validate if commment is provided */
  if (!comment) {
    throw new ApiError(400, "Comment is required");
  }

  /* Add a new comment */
  const newComment = await Comment.create({
    content: comment,
    video: new mongoose.Types.ObjectId(videoId),
    owner: new mongoose.Types.ObjectId(req.user?._id),
  });

  /* Returning the comment from DB */
  const newCommentAggregated = await Comment.aggregate(
    getCommentAggregationPipeline({
      _id: new mongoose.Types.ObjectId(newComment?._id),
    })
  );
  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        newCommentAggregated?.[0],
        "Comment added successfully"
      )
    );
});

const updateComment = asyncHandler(async (req, res) => {
  // DONE: update a comment
  const { commentId } = req.params;
  const { comment } = req.body;

  /* Validate if updated comment is provided */
  if (!comment) {
    throw new ApiError(400, "Comment Is Required");
  }

  /* Validate if comment exists in db */
  const commentObjFromDB = await Comment.findById(commentId);
  if (!commentObjFromDB) {
    throw new ApiError(404, "Invalid Comment ID, Comment not found");
  }

  /* Validate if the owner of the comment is the user logged in */
  if (!commentObjFromDB.owner.equals(req.user?._id)) {
    throw new ApiError(403, "You are unauthorized to update this comment");
  }

  /* Update the comment */
  commentObjFromDB.content = comment;

  await commentObjFromDB.save();

  const updatedCommentAggregated = await Comment.aggregate(
    getCommentAggregationPipeline({
      _id: new mongoose.Types.ObjectId(commentObjFromDB._id),
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedCommentAggregated,
        "Comment Updated Successfully"
      )
    );
});

const deleteComment = asyncHandler(async (req, res) => {
  // DONE: delete a comment
  const { commentId } = req.params;

  /* Validate if comment exists */
  const commentObjFromDB = await Comment.findById(commentId);
  if (!commentObjFromDB) {
    throw new ApiError(404, "Invalid Comment ID, Comment not found");
  }

  /* Validate if the owner of the comment is the user logged in */
  if (!commentObjFromDB.owner.equals(req.user?._id)) {
    throw new ApiError(403, "You are unauthorized to delete this comment");
  }

  /* Deleting the comment document */
  await Comment.findByIdAndDelete(commentId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Comment Deleted Successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
