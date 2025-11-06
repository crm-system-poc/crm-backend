import express from 'express';
import {
  createQuotation,
  generateQuotationPDF,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  getQuotationsByLead
} from '../controllers/quotationController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createQuotation);
router.get('/', getAllQuotations);
router.get('/lead/:leadId', getQuotationsByLead);
router.get('/:id', getQuotationById);
router.get('/:id/pdf', generateQuotationPDF);
router.put('/:id/status', updateQuotationStatus);

export default router;