import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * @param {string} cloudinaryUrl
 * @returns cloudinary public id
 */
const extractPublicIdFromUrl = (cloudinaryUrl) => {
  if (typeof cloudinaryUrl === "string") {
    /* Split by / */
    const slashSeparatedList = cloudinaryUrl.split("/");

    /* Last element which includes file name.<extension> */
    const lastElement = slashSeparatedList[slashSeparatedList.length - 1];

    /* Removing the extension */
    const afterEliminatingFileExtension = lastElement.split(".")[0];
    return afterEliminatingFileExtension;
  }
  return "";
};
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    //upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfull
    //console.log("file is uploaded on cloudinary ", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};

/* To upload files greater than 100 MB  */
const uploadLargeFilesOnCloudinary = async (localFilePath, resourceType) => {
  try {
    if (!localFilePath) {
      return null;
    }
    const response = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(
        localFilePath,
        {
          resource_type: resourceType,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};

const deleteFromCloudinary = async (cloudinaryURL, resourceType) => {
  try {
    if (!cloudinaryURL) {
      return false;
    }
    const publicId = extractPublicIdFromUrl(cloudinaryURL);
    if (!publicId) {
      return false;
    }
    let options = {};
    if(resourceType){
      options = {resource_type: resourceType}
    }
    const response = await cloudinary.uploader.destroy(publicId, options);
    console.log("Delete from cloudinary", response, publicId);
    if (response.result === "ok") {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export {
  uploadOnCloudinary,
  uploadLargeFilesOnCloudinary,
  deleteFromCloudinary,
};
