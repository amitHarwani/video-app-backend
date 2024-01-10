import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //DONE: create tweet
    const {content} = req.body;

    if(!content){
        throw new ApiError(400, "Content is required");
    }

    const newTweet = await Tweet.create({
        content: content,
        owner: new mongoose.Types.ObjectId(req.user?._id)
    })

    return res.status(201).json(new ApiResponse(201, newTweet, "Tweet created successfully"));
})

const getUserTweets = asyncHandler(async (req, res) => {
    // DONE: get user tweets
    const {userId} = req.params;

    const tweets = await Tweet.find({owner: userId});

    return res.status(200).json(new ApiResponse(200, tweets, "Tweets fetched successfully"));
})

const updateTweet = asyncHandler(async (req, res) => {
    //DONE: update tweet
    const {tweetId} = req.params;
    const {content} = req.body;

    if(!content){
        throw new ApiError(400, "Content is required");
    }

    const tweet = await Tweet.findById(tweetId);

    if(!tweet){
        throw new ApiError(404, "Tweet not found, Invalid tweet id");
    }

    if(!tweet.owner.equals(req.user?._id)){
        throw new ApiError(403, "You are unauthorized to update this tweet");
    }

    tweet.content = content;

    await tweet.save();

    return res.status(200).json(new ApiResponse(200, tweet, "Tweet updated successfully"));
})

const deleteTweet = asyncHandler(async (req, res) => {
    //DONE: delete tweet
    const {tweetId} = req.params;

    const tweet = await Tweet.findById(tweetId);

    if(!tweet){
        throw new ApiError(404, "Tweet not found, Invalid tweet id");
    }

    if(!tweet.owner.equals(req.user?._id)){
        throw new ApiError(403, "You are unauthorized to update this tweet");
    }

    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

    return res.status(200).json(new ApiResponse(200, deletedTweet, "Tweet deleted successfully"));

})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
