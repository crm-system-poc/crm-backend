import express from "express";
import {
  createInquiry,
  getAllInquiries,
  getInquiryById,
  updateInquiry,
  deleteInquiry,
  convertInquiryToLead
} from "../controllers/inquiryController.js";

import { authMiddleware, authorize } from "../middlewares/authMiddleware.js";
import reassignInquiry from "../controllers/reassign/reassignInquiry.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", authorize("manageInquiry", "create"), createInquiry);
router.get("/", authorize("manageInquiry", "read"), getAllInquiries);
router.get("/:id", authorize("manageInquiry", "read"), getInquiryById);
router.put("/:id", authorize("manageInquiry", "update"), updateInquiry);
router.delete("/:id", authorize("manageInquiry", "delete"), deleteInquiry);

// 🔁 Reassign users
router.put(
  "/:id/reassign",
  authorize("manageInquiry", "update"),
  reassignInquiry
);

// Convert → Lead
router.post("/:id/convert", authorize("manageInquiry", "update"), convertInquiryToLead);

export default router;
