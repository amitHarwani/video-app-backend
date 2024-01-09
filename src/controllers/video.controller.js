import mongoose, { Mongoose, isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadLargeFilesOnCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import {
  ACCEPTED_SORT_TYPES,
  CLOUDINARY_LARGE_FILE_LIMIT,
} from "../constants.js";

const getAllVideos = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //DONE: get all videos based on query, sort, pagination
  page = Number(page);
  limit = Number(limit);

  /* Validations*/
  if (isNaN(page) || isNaN(limit)) {
    throw new ApiError(400, "Invalid page & limit passed");
  }
  if (!userId) {
    throw new ApiError(400, "User Id is required");
  }
  if (sortType && !ACCEPTED_SORT_TYPES.includes(sortType)) {
    throw new ApiError(400, "Invalid Sort Type");
  }
  if (sortType && !sortBy) {
    throw new ApiError(400, "Provide Sort By Field, Or exclude sortType");
  }

  /* To find the videos where the owner is the userId passed and to add info of user into the video object  */
  const filteringAggregation = Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
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
        owner: { $first: "$owner" },
      },
    },
  ]);

  /* Pagination & Sorting*/
  const response = await Video.aggregatePaginate(filteringAggregation, {
    page,
    limit,
    sort: { [sortBy]: sortType },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, response, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // DONE: get video, upload to cloudinary, create video

  /* Checking if title and description are provided */
  if ([title, description].some((value) => value?.trim() === "" || !value)) {
    throw new ApiError(400, "Title and description are required");
  }

  const videoFile = req.files?.videoFile?.[0];
  const thumbnailFile = req.files?.thumbnail?.[0];

  /* Local Paths for video and thumbnail */
  const videoFileLocalPath = videoFile?.path;
  const thumbnailLocalPath = thumbnailFile?.path;

  if (!videoFileLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "Video File And Thumbnail are Required");
  }

  if (!videoFile?.mimetype?.includes("video")) {
    throw new ApiError(400, "Invalid video file format");
  }
  if (!thumbnailFile.mimetype?.includes("image")) {
    throw new ApiError(400, "Invalid thumbnail file format");
  }

  /* Uploading Video to Cloudinary */
  let videoOnCloudinary;

  /* Greater than 100 MB size */
  if (videoFile.size > CLOUDINARY_LARGE_FILE_LIMIT) {
    videoOnCloudinary = await uploadLargeFilesOnCloudinary(videoFileLocalPath, "video");
  } else {
    videoOnCloudinary = await uploadOnCloudinary(videoFileLocalPath);
  }

  /* Failed to upload video on cloudinary */
  if (!videoOnCloudinary) {
    throw new ApiError(500, "Error while uploading video");
  }

  const thumbnailOnCloudinary = await uploadOnCloudinary(thumbnailLocalPath);

  /* Failed to upload thumbnail on cloudinary */
  if (!thumbnailOnCloudinary) {
    /* Deleting video from cloudinary as the operation has failed */
    await deleteFromCloudinary(videoOnCloudinary.url);

    throw new ApiError(500, "Error while uploading thumbnail");
  }

  const newVideo = {
    videoFile: videoOnCloudinary.secure_url,
    thumbnail: thumbnailOnCloudinary.secure_url,
    title,
    description,
    duration: videoOnCloudinary.duration,
    owner: new mongoose.Types.ObjectId(req.user._id),
  };

  await Video.create(newVideo);

  return res
    .status(201)
    .json(new ApiResponse(201, newVideo, "Video Published Successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //DONE: get video by id

  /* To find the video with the matching id passed and to add info of user into the video object  */
  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
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
              email: 1,
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //DONE: update video details like title, description, thumbnail

  const { title, description } = req.body;

  /* Checking if title and description are provided */
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }

  /* Checking if video exists */
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const thumbnailFile = req?.file;
  /* If thumbnail file is provided: Updating it */
  if (thumbnailFile) {
    const thumbnailOnCloudinary = await uploadOnCloudinary(thumbnailFile?.path);

    if (!thumbnailOnCloudinary) {
      throw new ApiError(500, "Error while uploading thumbnail to cloudinary");
    }

    /* Deleting current thumbnail file */
    await deleteFromCloudinary(video.thumbnail);

    video.thumbnail = thumbnailOnCloudinary.secure_url;
  }

  video.title = title;
  video.description = description;

  await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video Updated Successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video

  const video = await Video.findById(videoId);

  if(!video){
    throw new ApiError(404, "Video not found");
  }
  
  /* Deleting thumbail and video files from cloudinary */
  await deleteFromCloudinary(video.thumbnail);
  await deleteFromCloudinary(video.videoFile, "video");

  const response = await Video.findByIdAndDelete(videoId);

  return res
    .status(200)
    .json(new ApiResponse(200, response, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const video = await Video.findById(videoId);

  if(!video){
    throw new ApiError(404, "Video Not Found");
  }
  video.isPublished = !video.isPublished;

  await video.save();
  return res.status(200).json(new ApiResponse(200, video, `Publish status toggled to ${video.isPublished}`));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
