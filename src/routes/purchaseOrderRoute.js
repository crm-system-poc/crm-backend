import express from 'express';
import {
  createPurchaseOrder,
  addAttachment,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  getPurchaseOrdersByLead,
  deletePurchaseOrder,
  getExpiringLicenses
} from '../controllers/purchaseOrderController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { uploadFields } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', uploadFields([
    { name: 'poPdf', maxCount: 1 },
    { name: 'attachments', maxCount: 10 } 
  ]), createPurchaseOrder);
  
  router.post('/:id/attachments', uploadFields([
    { name: 'attachment', maxCount: 1 }
  ]), addAttachment);

router.get('/', getAllPurchaseOrders);

router.get('/expiring-licenses', getExpiringLicenses);

router.get('/lead/:leadId', getPurchaseOrdersByLead);

router.get('/:id', getPurchaseOrderById);

router.put('/:id/status', updatePurchaseOrderStatus);

router.delete('/:id', deletePurchaseOrder);

export default router;