import express from "express";
import {
  createAccount,
  getAllAccounts,
  getAccountById,
  updateAccount,
  deleteAccount,
  getAccountRelatedData,
  getAccountOutstanding
} from "../controllers/accountController.js";

import { authMiddleware, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/",
  authorize("manageLeads", "create"),
  createAccount
);

router.get(
  "/",
  authorize("manageLeads", "read"),
  getAllAccounts
);

router.get(
  "/:id/related",
  authorize("manageLeads", "read"),
  getAccountRelatedData
);

router.get(
  "/:id",
  authorize("manageLeads", "read"),
  getAccountById
);

router.put(
  "/:id",
  authorize("manageLeads", "update"),
  updateAccount
);

router.delete(
  "/:id",
  authorize("manageLeads", "delete"),
  deleteAccount
);

router.get(
  "/outstanding-balance",
  authorize("manageLeads", "read"),
  getAccountOutstanding
);




export default router;
