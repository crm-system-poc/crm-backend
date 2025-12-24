import express from "express";
import { authMiddleware, authorize } from "../middlewares/authMiddleware.js";
import {
  getAllSalesPOs,
  getSalesPOById,
  createSalesPO,
  updateSalesPO,
  deleteSalesPO,
} from "../controllers/salesPo.controller.js";

const router = express.Router();

/* -------------------------------------------------------
   AUTH
------------------------------------------------------- */
router.use(authMiddleware);

/* -------------------------------------------------------
   SALES PO ROUTES
------------------------------------------------------- */

// CREATE Sales PO (from Base PO)
router.post(
  "/sales-purchase-orders",
  authorize("managePurchaseOrder", "create"),
  createSalesPO
);

// GET ALL Sales POs
router.get(
  "/sales-purchase-orders",
  authorize("managePurchaseOrder", "read"),
  getAllSalesPOs
);

// GET Sales PO by ID
router.get(
  "/sales-purchase-orders/:id",
  authorize("managePurchaseOrder", "read"),
  getSalesPOById
);

// UPDATE Sales PO
router.put(
  "/sales-purchase-orders/:id",
  authorize("managePurchaseOrder", "update"),
  updateSalesPO
);

// DELETE Sales PO
router.delete(
  "/sales-purchase-orders/:id",
  authorize("managePurchaseOrder", "delete"),
  deleteSalesPO
);

export default router;
