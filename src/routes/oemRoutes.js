import express from "express";
import {
  createOEM,
  getAllOEMs,
  getOEMById,
  updateOEM,
  deleteOEM,
  getOEMDropdown,
} from "../controllers/oemController.js";
import { authMiddleware, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);
router.get("/dropdown", getOEMDropdown);

router.post("/", authorize("manageProducts", "create"), createOEM);
router.get("/", authorize("manageProducts", "read"), getAllOEMs);
router.get("/:id", authorize("manageProducts", "read"), getOEMById);
router.put("/:id", authorize("manageProducts", "update"), updateOEM);
router.delete("/:id", authorize("manageProducts", "delete"), deleteOEM);



export default router;
