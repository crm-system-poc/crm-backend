import express from "express";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { authMiddleware, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/",
  authorize("manageProducts", "create"),
  createProduct
);


router.get(
  "/",
  authorize("manageProducts", "read"),
  getProducts
);


router.get(
  "/:id",
  authorize("manageProducts", "read"),
  getProductById
);


router.put(
  "/:id",
  authorize("manageProducts", "update"),
  updateProduct
);

router.delete(
  "/:id",
  authorize("manageProducts", "delete"),
  deleteProduct
);

export default router;
