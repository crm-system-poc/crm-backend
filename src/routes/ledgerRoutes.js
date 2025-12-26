import express from "express";
import {
  getLedgers,
  getLedgerByPO,
  getAccountLedger,
  getAccountLedgerSummary,
} from "../controllers/ledgerController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", getLedgers);
router.get("/po/:poId", getLedgerByPO);

router.get(
  "/account/:accountId",
  getAccountLedger
);

router.get(
  "/account/:accountId/summary",
  getAccountLedgerSummary
);

export default router;
