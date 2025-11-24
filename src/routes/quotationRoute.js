import express from 'express';
import {
  createQuotation,
  deleteQuotation,
  deleteQuotationPDF,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  getQuotationsByLead,
  getQuotationStats
} from '../controllers/quotationController.js';
import { authMiddleware, authorize } from '../middlewares/authMiddleware.js';
import { uploadPDF } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', authorize("manageQuotation", "create"),  uploadPDF, createQuotation);
router.get('/stats', authorize("manageQuotation", "read"), getQuotationStats);

router.delete('/:id', authorize("manageQuotation", "delete"), deleteQuotation);

router.delete('/:id/pdf', authorize("manageQuotation", "delete"), deleteQuotationPDF);

router.get('/',authorize("manageQuotation", "read"), getAllQuotations);
router.get('/lead/:leadId', authorize("manageQuotation", "read"), getQuotationsByLead);
router.get('/:id', authorize("manageQuotation", "read"), getQuotationById);
router.put('/:id/status', authorize("manageQuotation", "update"), updateQuotationStatus);

export default router;