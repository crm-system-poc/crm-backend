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
import {reassignQuotation } from '../controllers/reassign/reassignQuotation.js'

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

router.put("/:id/reassign", authorize("manageQuotation", "update"), reassignQuotation);


export default router;