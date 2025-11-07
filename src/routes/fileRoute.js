import express from 'express';
import {
  uploadFile,
  uploadMultipleFiles,
  getFiles,
  getFilePresignedUrl,
  downloadFile,
  deleteFile,
  uploadProfileImage,
  uploadQuotationPDF
} from '../controllers/fileController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import {
  uploadSingle,
  uploadMultiple,
  uploadImage,
  uploadPDF,
  uploadMultipleFiles as uploadMultipleMiddleware
} from '../middlewares/uploadMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Single file upload
router.post('/upload', uploadSingle('file'), uploadFile);

// Multiple files upload
router.post('/upload-multiple', uploadMultipleMiddleware, uploadMultipleFiles);

// Profile image upload
router.post('/upload/profile-image', uploadImage, uploadProfileImage);

// Quotation PDF upload
router.post('/upload/quotation-pdf', uploadPDF, uploadQuotationPDF);

// Get files by folder
router.get('/folder/:folder', getFiles);

// Get presigned URL
router.get('/presigned-url/:key', getFilePresignedUrl);

// Get download URL
router.get('/download/:key', downloadFile);

// Delete file
router.delete('/:key', deleteFile);

export default router;