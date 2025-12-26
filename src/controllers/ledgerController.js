import Ledger from "../models/Ledger.js";
import { getSuperAdminId } from "../utils/superAdmin.js";
import mongoose from "mongoose";

export const getLedgers = async (req, res) => {
  const filter = {
    superAdminId: req.admin.superAdminId || req.admin.id,
  };

  const ledgers = await Ledger.find(filter)
    .populate("accountId", "customerName email")
    .populate("quotationId", "quoteId")
    .populate("purchaseOrderId", "poNumber")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: ledgers });
};

export const getLedgerByPO = async (req, res) => {
  const ledger = await Ledger.findOne({
    purchaseOrderId: req.params.poId,
    superAdminId: req.admin.superAdminId || req.admin.id,
  });

  if (!ledger) {
    return res.status(404).json({
      success: false,
      error: "Ledger not found",
    });
  }

  res.json({ success: true, data: ledger });
};


export const getAccountLedger = async (req, res) => {
  try {
    const { accountId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const superAdminId = getSuperAdminId(req);

    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid accountId",
      });
    }

    const skip = (page - 1) * limit;

    const filter = {
      accountId,
      superAdminId,
    };

    const [ledgers, total] = await Promise.all([
      Ledger.find(filter)
        .populate("purchaseOrderId", "poNumber poDate totalAmount")
        .populate("quotationId", "quoteId")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),

      Ledger.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: ledgers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


export const getAccountLedgerSummary = async (req, res) => {
  try {
    const { accountId } = req.params;
    const superAdminId = getSuperAdminId(req);

    const summary = await Ledger.aggregate([
      {
        $match: {
          accountId: new mongoose.Types.ObjectId(accountId),
          superAdminId: new mongoose.Types.ObjectId(superAdminId),
        },
      },
      {
        $group: {
          _id: "$accountId",
          totalLedgerAmount: { $sum: "$totalAmount" },
          totalPOs: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: summary[0] || {
        totalLedgerAmount: 0,
        totalPOs: 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
