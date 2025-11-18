import express from 'express';
import {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats,getLeadsByCustomer
} from '../controllers/leadController.js';
import { authMiddleware , authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', createLead);
router.get('/', getAllLeads);
router.get('/stats', getLeadStats);
router.get('/customer/:customerIdentifier', getLeadsByCustomer);
router.get('/:id', getLeadById);
router.put('/:id',  updateLead);
router.delete('/:id', deleteLead);

export default router;