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
import reassignLead  from '../controllers/reassign/reassignLead.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', authorize("manageLeads", "create"), createLead);
router.get('/', authorize("manageLeads", "read"), getAllLeads);
router.get('/stats', authorize("manageLeads", "read"), getLeadStats);
router.get('/customer/:customerIdentifier', authorize("manageLeads", "read"), getLeadsByCustomer);
router.get('/:id',authorize("manageLeads", "read"), getLeadById);
router.put('/:id', authorize("manageLeads", "update"), updateLead);
router.delete('/:id',authorize("manageLeads", "delete"), deleteLead);

router.put("/:id/reassign", authorize("manageLeads", "update"), reassignLead);


export default router;