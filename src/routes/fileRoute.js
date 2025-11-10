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

router.use(authMiddleware);
router.post('/upload', uploadSingle('file'), uploadFile);

router.post('/upload-multiple', uploadMultipleMiddleware, uploadMultipleFiles);

router.post('/upload/profile-image', uploadImage, uploadProfileImage);

router.post('/upload/quotation-pdf', uploadPDF, uploadQuotationPDF);

router.get('/folder/:folder', getFiles);

router.get('/presigned-url/:key', getFilePresignedUrl);

router.get('/download/:key', downloadFile);

router.delete('/:key', deleteFile);

export default router;