import express from 'express';
import {
  getMonthlyLicenseExpiry,
  getSalesFunnelReport,
  getDashboardReports,
  getAllExpireLicense
} from '../controllers/reportController.js';
import { authMiddleware, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get("/expiring-licenses", authorize("manageReport", "read"), getAllExpireLicense);

router.get('/license-expiry', authorize("manageReport", "read"), getMonthlyLicenseExpiry);

router.get('/sales-funnel', authorize("manageReport", "read"), getSalesFunnelReport);

router.get('/dashboard', authorize("manageReport", "read"), getDashboardReports);




export default router;