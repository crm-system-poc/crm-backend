import express from 'express';
import {
  createQuotation,
  deleteQuotation,
  deleteQuotationPDF,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  getQuotationsByLead
} from '../controllers/quotationController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { uploadPDF } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', uploadPDF, createQuotation);
router.delete('/:id', deleteQuotation);
// router.put('/:id/upload-pdf', uploadPDF, uploadQuotationPDF);

// router.get('/:id/download-pdf', downloadQuotationPDF);

router.delete('/:id/pdf', deleteQuotationPDF);

router.get('/', getAllQuotations);
router.get('/lead/:leadId', getQuotationsByLead);
router.get('/:id', getQuotationById);
router.put('/:id/status', updateQuotationStatus);

export default router;