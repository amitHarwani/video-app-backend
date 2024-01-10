import mongoose, { Mongoose, isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";

/* Returns an array to be used as aggregation pipeline to get playlists */
const getPlaylistAggregationPipeline = (matchObject) => {
  /**
   * Gets the playlist according to the matchObject criteria passed
   * Populates the owner field with user info
   * Populates video field with video info and the owner field in vide with the user info
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
    {
      $unwind: {
        path: "$videos",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videos",
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
                    fullName: 1,
                    avatar: 1,
                    email: 1,
                    username: 1,
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
        videos: {
          $first: "$videos",
        },
      },
    },
    {
      $group: {
        _id: "$_id",
        videos: {
          $push: "$videos",
        },
        name: { $first: "$name" },
        description: { $first: "$description" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
        owner: { $first: "$owner" },
      },
    },
  ];
};
const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  //DONE: create playlist
  if (!name || !description) {
    throw new ApiError(400, "Name and description are required");
  }

  const newPlaylist = {
    name,
    description,
    owner: new mongoose.Types.ObjectId(req.user?._id),
  };

  const createdPlaylist = await Playlist.create(newPlaylist);

  return res
    .status(201)
    .json(
      new ApiResponse(201, createdPlaylist, "Playlist created successfully")
    );
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //DONE: get user playlists

  const playlistOfUser = await Playlist.aggregate(
    getPlaylistAggregationPipeline({
      owner: new mongoose.Types.ObjectId(userId),
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlistOfUser, "Playlist fetched successfully")
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //DONE: get playlist by id

  const playlist = await Playlist.aggregate(
    getPlaylistAggregationPipeline({
      _id: new mongoose.Types.ObjectId(playlistId),
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  /* Checking if user is the owner of the playlist */
  if (!playlist.owner.equals(req.user?._id)) {
    throw new ApiError(403, "You are unauthorized to edit the playlist");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video Not Found");
  }

  if (playlist.videos.includes(videoId)) {
    throw new ApiError(400, "Video is already a part of the playlist");
  }

  playlist.videos.push(new mongoose.Types.ObjectId(videoId));

  await playlist.save();

  const newPlaylist = await Playlist.aggregate(
    getPlaylistAggregationPipeline({
      _id: new mongoose.Types.ObjectId(playlistId),
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, newPlaylist[0], "Video Added To Playlist"));
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  // DONE: remove video from playlist

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  /* Checking if user is the owner of the playlist */
  if (!playlist.owner.equals(req.user?._id)) {
    throw new ApiError(403, "You are unauthorized to edit the playlist");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const videoIndexInPlaylist = playlist.videos.findIndex((video) =>
    video.equals(videoId)
  );
  if (videoIndexInPlaylist === -1) {
    throw new ApiError(400, "Video is not in the playlist");
  }

  playlist.videos.splice(videoIndexInPlaylist, 1);

  await playlist.save();

  const updatedPlaylist = await Playlist.aggregate(
    getPlaylistAggregationPipeline({
      _id: new mongoose.Types.ObjectId(playlistId),
    })
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedPlaylist[0], "Video removed from playlist"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  // DONE: delete playlist

  const playlist = await Playlist.findById(playlistId);

  if(!playlist){
    throw new ApiError(404, "Playlist not found");
  }
  if(!playlist.owner.equals(req.user?._id)){
    throw new ApiError(403, "You are unauthorized to edit the playlist")
  }

  await Playlist.findByIdAndDelete(playlistId);

  return res.status(200).json(new ApiResponse(200, {}, "Playlist deleted successfully"));

});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  //DONE: update playlist

  if (!name || !description) {
    throw new ApiError(400, "Name and description are required");
  }

  const playlist = await Playlist.findById(playlistId);

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (!playlist.owner.equals(req.user?._id)) {
    throw new ApiError(403, "You are unauthorized to edit the playlist");
  }

  playlist.name = name;
  playlist.description = description;

  await playlist.save();

  const updatedPlaylist = await Playlist.aggregate(
    getPlaylistAggregationPipeline({
      _id: new mongoose.Types.ObjectId(playlistId),
    })
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist[0], "Playlist updated successfully")
    );
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
