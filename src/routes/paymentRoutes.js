import express from "express";
import { createPayment , getAccountPaymentHistory } from "../controllers/paymentController.js";
import { authMiddleware, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/collect",
  authMiddleware,
  authorize("managePurchaseOrder", "update"),
  createPayment
);

router.get(
    "/account/:accountId",
    authMiddleware,
    authorize("managePurchaseOrder", "read"),
    getAccountPaymentHistory
  );
  

export default router;
