import express from 'express';
import {
  createPurchaseOrder,
  addAttachment,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  getPurchaseOrdersByLead,
  deletePurchaseOrder,
  getExpiringLicenses,
  getPurchaseOrdersStats
} from '../controllers/purchaseOrderController.js';
import { authMiddleware , authorize} from '../middlewares/authMiddleware.js';
import { uploadFields } from '../middlewares/uploadMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/', uploadFields([
    { name: 'poPdf', maxCount: 1 },
    { name: 'licenseFile', maxCount: 1 },
    { name: 'attachments', maxCount: 10 } 
  ]), createPurchaseOrder);

  router.get("/stats", authorize("managePurchaseOrder", "read"), getPurchaseOrdersStats)
  
  router.post('/:id/attachments', authorize("managePurchaseOrder", "create"), uploadFields([
    { name: 'attachment', maxCount: 1 }
  ]), addAttachment);

router.get('/', authorize("managePurchaseOrder", "read"), getAllPurchaseOrders);

router.get('/expiring-licenses', authorize("managePurchaseOrder", "read"), getExpiringLicenses);

router.get('/lead/:leadId', authorize("managePurchaseOrder", "read"), getPurchaseOrdersByLead);

router.get('/:id', authorize("managePurchaseOrder", "read"), getPurchaseOrderById);

router.put('/:id/status', authorize("managePurchaseOrder", "update"), updatePurchaseOrderStatus);

router.delete('/:id', authorize("managePurchaseOrder", "delete"), deletePurchaseOrder);

export default router;