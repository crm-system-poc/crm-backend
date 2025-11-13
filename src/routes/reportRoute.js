import express from 'express';
import {
  getMonthlyLicenseExpiry,
  getSalesFunnelReport,
  getDashboardReports,
  getAllExpireLicense
} from '../controllers/reportController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get("/expiring-licenses", getAllExpireLicense);

router.get('/license-expiry', getMonthlyLicenseExpiry);

router.get('/sales-funnel', getSalesFunnelReport);

router.get('/dashboard', getDashboardReports);




export default router;