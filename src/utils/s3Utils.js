import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;

// Generic file upload function
const uploadToS3 = async (file, folder = 'general') => {
  const key = `${folder}/${Date.now()}-${file.originalname}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  try {
    await s3Client.send(command);
    const fileUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return { 
      key, 
      url: fileUrl,
      originalName: file.originalname,
      fileSize: file.size,
      contentType: file.mimetype
    };
  } catch (error) {
    console.error("Upload error:", error.message);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

// Upload with custom key
const uploadFileWithKey = async (fileBuffer, key, contentType) => {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    const fileUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    return { key, url: fileUrl };
  } catch (error) {
    console.error("Upload error:", error.message);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

// Get files by folder/user
const getFilesByFolder = async (folder) => {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: folder,
  });

  try {
    const { Contents = [] } = await s3Client.send(command);
    return Contents.sort(
      (a, b) => new Date(b.LastModified) - new Date(a.LastModified)
    ).map((file) => ({
      key: file.Key,
      lastModified: file.LastModified,
      size: file.Size
    }));
  } catch (error) {
    console.error("ListObjects error:", error.message);
    throw new Error(`Failed to retrieve files: ${error.message}`);
  }
};

// Generate presigned URL for file access
const getPresignedUrl = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({ 
      Bucket: BUCKET, 
      Key: key 
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("Presigned URL error:", error.message);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
};

// Delete file from S3
const deleteFileFromS3 = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  try {
    await s3Client.send(command);
    return { success: true, message: 'File deleted successfully' };
  } catch (error) {
    console.error("Delete error:", error.message);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

// Generate download URL (presigned)
const getDownloadUrl = async (key, filename, expiresIn = 900) => {
  try {
    const command = new GetObjectCommand({ 
      Bucket: BUCKET, 
      Key: key 
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return { url, filename };
  } catch (error) {
    console.error("Download URL error:", error.message);
    throw new Error(`Failed to generate download URL: ${error.message}`);
  }
};

export {
  s3Client,
  uploadToS3,
  uploadFileWithKey,
  getFilesByFolder,
  getPresignedUrl,
  deleteFileFromS3,
  getDownloadUrl
};