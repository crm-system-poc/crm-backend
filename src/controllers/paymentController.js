import Payment from "../models/Payment.js";
import Ledger from "../models/Ledger.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { getSuperAdminId } from "../utils/superAdmin.js";



export const createPayment = async (req, res) => {
    try {
      const {
        ledgerId,
        purchaseOrderId,
        amountCollected,
        paymentMode,
        note,
      } = req.body;
  
      if (!ledgerId || !purchaseOrderId || amountCollected === undefined) {
        return res.status(400).json({
          success: false,
          error: "ledgerId, purchaseOrderId and amountCollected are required",
        });
      }
  
      const collectedAmount = Number(amountCollected);
      if (isNaN(collectedAmount) || collectedAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid amountCollected",
        });
      }
  
      // 🔐 Fetch Ledger
      const ledger = await Ledger.findOne({
        _id: ledgerId,
        superAdminId: getSuperAdminId(req),
      });
  
      if (!ledger) {
        return res.status(404).json({
          success: false,
          error: "Ledger not found",
        });
      }
  
      const ledgerTotalPaid = Number(ledger.totalPaid || 0);
      const ledgerTotalAmount = Number(ledger.totalAmount || 0);
  
      const newTotalPaid = ledgerTotalPaid + collectedAmount;
      const newTotalDue = ledgerTotalAmount - newTotalPaid;
  
      if (newTotalPaid > ledgerTotalAmount) {
        return res.status(400).json({
          success: false,
          error: "Collected amount exceeds due amount",
        });
      }
  
      let newStatus = "due";
      if (newTotalPaid === ledgerTotalAmount) newStatus = "paid";
      else if (newTotalPaid > 0) newStatus = "partial";
  
      // 🧾 Find or create Payment
      let payment = await Payment.findOne({
        ledgerId,
        purchaseOrderId,
        superAdminId: getSuperAdminId(req),
      });
  
      if (!payment) {
        payment = await Payment.create({
          accountId: ledger.accountId,
          ledgerId,
          purchaseOrderId,
          superAdminId: getSuperAdminId(req),
          totalAmount: ledgerTotalAmount,
          totalPaid: 0,
          totalDue: ledgerTotalAmount,
          status: "due",
          createdBy: req.admin.id,
          accountPayments: [],
        });
      }
  
      payment.accountPayments.push({
        amountCollected: collectedAmount,
        paymentMode,
        note,
      });
  
      payment.totalPaid = newTotalPaid;
      payment.totalDue = newTotalDue;
      payment.status = newStatus;
      await payment.save();
  
      // 🔄 Update Ledger
      ledger.totalPaid = newTotalPaid;
      ledger.totalDue = newTotalDue;
      ledger.status = newStatus;
      await ledger.save();
  
      res.status(201).json({
        success: true,
        message: "Payment recorded successfully",
        data: {
          ledgerId,
          totalPaid: newTotalPaid,
          totalDue: newTotalDue,
          status: newStatus,
        },
      });
    } catch (error) {
      console.error("❌ createPayment error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
  


export const getAccountPaymentHistory = async (req, res) => {
    try {
      const { accountId } = req.params;
  
      const payments = await Payment.find({
        accountId,
        superAdminId: getSuperAdminId(req),
      })
        .populate("purchaseOrderId", "poNumber poDate totalAmount")
        .sort({ createdAt: -1 });
  
      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error("❌ Payment history error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
