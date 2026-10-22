import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const getCloudinary = () => {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      "❌ Cloudinary ENV missing. Check .env loading order or variable names."
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
};

// 📤 Upload file to Cloudinary
const uploadFileOnCloudinary = async (localFilePath) => {
  if (!localFilePath) return null;

  try {
    const response = await getCloudinary().uploader.upload(localFilePath, {
      resource_type: "auto", // image / video / pdf
      folder: "users",
    });

    // 🧹 delete local temp file
    fs.unlink(localFilePath, (err) => {
      if (err) console.error("Failed to delete temp file:", err);
    });

    return response;
  } catch (error) {
    // 🧹 cleanup even on failure
    fs.unlink(localFilePath, (err) => {
      if (err) console.error("Failed to delete temp file:", err);
    });

    throw new Error("Cloudinary upload failed: " + error.message);
  }
};

// 🗑️ Delete file from Cloudinary
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return null;

  try {
    return await getCloudinary().uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    throw new Error("Cloudinary delete failed: " + error.message);
  }
};

export { uploadFileOnCloudinary, deleteFromCloudinary };