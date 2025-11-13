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
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { uploadPDF } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', uploadPDF, createQuotation);
router.get('/stats', getQuotationStats);

router.delete('/:id', deleteQuotation);

router.delete('/:id/pdf', deleteQuotationPDF);

router.get('/', getAllQuotations);
router.get('/lead/:leadId', getQuotationsByLead);
router.get('/:id', getQuotationById);
router.put('/:id/status', updateQuotationStatus);

export default router;