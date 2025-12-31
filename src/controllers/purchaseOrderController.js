import PurchaseOrder from "../models/PurchaseOrder.js";
import Lead from "../models/Lead.js";
import Quotation from "../models/Quotation.js";
import { uploadToS3, deleteFileFromS3 } from "../utils/s3Utils.js";
import { getSuperAdminId } from "../utils/superAdmin.js";
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Ledger from "../models/Ledger.js";

/**
 * Safely compare ObjectId / strings / docs having _id
 */
const isSameId = (a, b) => {
  if (!a || !b) return false;
  const aStr =
    typeof a === "string" ? a : a._id ? a._id.toString() : a.toString();
  const bStr =
    typeof b === "string" ? b : b._id ? b._id.toString() : b.toString();
  return aStr === bStr;
};

/**
 * Record Based Access for PurchaseOrder
 * action: "read" | "update" | "delete"
 */
const canAccessPurchaseOrder = (po, admin, action) => {
  if (!po || !admin) return false;

  // 1) SuperAdmin => full access
  if (admin.systemrole === "SuperAdmin") return true;

  // 2) Creator => full access
  if (isSameId(po.createdBy, admin.id)) return true;

  // 3) Assigned users with per-record permissions
  const assignedEntry = (po.assignedUsers || []).find((u) =>
    isSameId(u.user, admin.id)
  );

  if (!assignedEntry || !assignedEntry.permissions) return false;

  return assignedEntry.permissions[action] === true;
};

/**
 * Helper: Generate next Purchase Order number (fallback implementation)
 * Format: PO-YYYY-<increment>
 */
const generateNextPONumber = async () => {
  // Find the latest PO based on poNumber, sorted desc by poDate & createdAt as fallback.
  const latestPO = await PurchaseOrder.findOne({})
    .sort({ poDate: -1, createdAt: -1 })
    .select("poNumber poDate")
    .lean();

  const currentYear = new Date().getFullYear().toString();

  let nextIncrement = 1;
  if (latestPO && latestPO.poNumber) {
    // Expecting something like PO-2024-00125 or PO-2024-12
    const poNumberParts = latestPO.poNumber.split("-");
    if (poNumberParts.length === 3 && poNumberParts[1] === currentYear) {
      const lastNumber = parseInt(poNumberParts[2], 10);
      if (!isNaN(lastNumber)) {
        nextIncrement = lastNumber + 1;
      }
    } else if (poNumberParts.length === 3) {
      // Start from 1 if year changed
      nextIncrement = 1;
    }
  }
  // Pad to 5 digits (e.g. 00001)
  const padded = String(nextIncrement).padStart(5, '0');
  return `PO-${currentYear}-${padded}`;
};

/**
 * CREATE PURCHASE ORDER (create)
 * When creating purchase order, also post oemPrice with unitPrice in each item.
 */
const createPurchaseOrder = async (req, res) => {
  try {
    const {
      leadId,
      quotationId,
      items,
      paymentTerms,
      deliveryTerms,
      notes,
      poDate,
      assignedUsers,
    } = req.body;

    const superAdminId = getSuperAdminId(req);

    // ------------------------------------------------------------------
    // ✅ BASIC VALIDATIONS
    // ------------------------------------------------------------------
    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: "Lead ID is required",
      });
    }

    if (!req.files?.poPdf?.length) {
      return res.status(400).json({
        success: false,
        error: "PO PDF attachment is required",
      });
    }

    // ------------------------------------------------------------------
    // 🔐 FETCH LEAD (TENANT SAFE)
    // ------------------------------------------------------------------
    const lead = await Lead.findOne({
      _id: leadId,
      superAdminId,
    }).populate("accountId");

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    // ------------------------------------------------------------------
    // 🧠 RESOLVE ACCOUNT ID
    // Quotation → Lead → Auto-create
    // ------------------------------------------------------------------
    let resolvedAccountId = null;
    let quotation = null;

    // 1️⃣ From Quotation
    if (quotationId) {
      quotation = await Quotation.findOne({
        _id: quotationId,
        superAdminId,
      }).populate("accountId");

      if (!quotation) {
        return res.status(404).json({
          success: false,
          error: "Quotation not found",
        });
      }

      resolvedAccountId = quotation.accountId;
    }

    // 2️⃣ From Lead
    if (!resolvedAccountId && lead.accountId) {
      resolvedAccountId = lead.accountId;
    }

    // 3️⃣ Auto-create Account
    if (!resolvedAccountId) {
      const newAccount = await Account.create({
        customerName: lead.customerName,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        alternateEmail: lead.altEmail,
        alternateNumber: lead.altPhoneNumber,
        address: lead.address,
        location: lead.location,
        superAdminId,
        createdBy: req.admin.id,
      });

      resolvedAccountId = newAccount._id;

      // backfill lead
      lead.accountId = resolvedAccountId;
      await lead.save();
    }

    // ------------------------------------------------------------------
    // 🧾 ITEMS VALIDATION
    // ------------------------------------------------------------------
    const parsedItems = typeof items === "string" ? JSON.parse(items) : items;

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one item is required",
      });
    }

    const validatedPODate = poDate ? new Date(poDate) : new Date();
    if (validatedPODate > new Date()) {
      return res.status(400).json({
        success: false,
        error: "PO Date cannot be in the future",
      });
    }

    // ------------------------------------------------------------------
    // 📁 UPLOAD PO PDF
    // ------------------------------------------------------------------
    const folder = `purchase-orders/${superAdminId}`;
    const s3UploadResult = await uploadToS3(req.files.poPdf[0], folder);

    const poPdfData = {
      originalName: s3UploadResult.originalName,
      s3Key: s3UploadResult.key,
      s3Url: s3UploadResult.url,
      fileSize: s3UploadResult.fileSize,
      uploadedAt: new Date(),
    };

    // ------------------------------------------------------------------
    // 🧮 BUILD PO DATA
    // ------------------------------------------------------------------
    // Items: each must include oemPrice as posted from the client UI (see prompt)
    const poItems = parsedItems.map((item) => ({
      productId: item.productId,
      description: item.description,
      quantity: Number(item.quantity),
      licenseType: item.licenseType,
      licenseExpiryDate: item.licenseExpiryDate
        ? new Date(item.licenseExpiryDate)
        : undefined,
      unitPrice: Number(item.unitPrice || 0),
      totalPrice: Number(item.unitPrice || 0) * Number(item.quantity || 0),
      oemPrice: item.oemPrice !== undefined && item.oemPrice !== null
        ? Number(item.oemPrice)
        : undefined, // Always accept and save oemPrice as sent in post body.
    }));

    const totalAmount = poItems.reduce(
      (sum, item) => sum + (item.totalPrice || 0),
      0
    );

    const poData = {
      leadId,
      quotationId,
      accountId: resolvedAccountId,
      poDate: validatedPODate,

      customerDetails: {
        customerName: lead.customerName,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        address: lead.address,
      },

      items: poItems,
      paymentTerms,
      deliveryTerms,
      notes,
      poPdf: poPdfData,

      createdBy: req.admin.id,
      superAdminId,

      totalAmount,
    };

    if (Array.isArray(assignedUsers)) {
      poData.assignedUsers = assignedUsers;
    }

    // ------------------------------------------------------------------
    // 🎫 CREATE PO
    // ------------------------------------------------------------------
    poData.poNumber = await generateNextPONumber(superAdminId);

    const purchaseOrder = await PurchaseOrder.create(poData);

    // ------------------------------------------------------------------
    // 📒 CREATE LEDGER (AUTO)
    // ------------------------------------------------------------------
    await Ledger.create({
      superAdminId,
      accountId: resolvedAccountId,
      quotationId,
      purchaseOrderId: purchaseOrder._id,

      ledgerItems: poItems.map((item) => ({
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        oemPrice: item.oemPrice, // post with unitPrice
      })),

      totalAmount,
      createdBy: req.admin.id,
    });

    // ------------------------------------------------------------------
    // 🔄 POPULATE RESPONSE — also include oemPrice in items in response
    // ------------------------------------------------------------------
    await purchaseOrder.populate([
      { path: "leadId", select: "customerName contactPerson email" },
      { path: "quotationId", select: "quoteId totalQuoteValue" },
      { path: "accountId", select: "customerName email phoneNumber" },
      { path: "createdBy", select: "name email" },
      { path: "assignedUsers.user", select: "name email" },
    ]);

    // ensure oemPrice included (mirror all pattern in rest of file)
    const outPO = purchaseOrder.toObject();
    if (Array.isArray(outPO.items)) {
      outPO.items = outPO.items.map(item => ({
        ...item,
        oemPrice: item.oemPrice !== undefined ? item.oemPrice : undefined
      }));
    }

    res.status(201).json({
      success: true,
      message: "Purchase order & ledger created successfully",
      data: outPO,
    });
  } catch (error) {
    console.error("❌ Purchase order creation error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


/**
 * ADD ATTACHMENT (update)
 */
const addAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file provided",
      });
    }

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: id,
      superAdminId: getSuperAdminId(req),
    });
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    if (!canAccessPurchaseOrder(purchaseOrder, req.admin, "update")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to update this purchase order",
      });
    }

    console.log("📎 Adding attachment to PO:", purchaseOrder.poNumber);

    const folder = `purchase-orders/${req.admin.id}/attachments`;
    const s3UploadResult = await uploadToS3(req.file, folder);

    const attachment = {
      type: type || "other",
      originalName: s3UploadResult.originalName,
      s3Key: s3UploadResult.key,
      s3Url: s3UploadResult.url,
      fileSize: s3UploadResult.fileSize,
      uploadedAt: new Date(),
      notes: notes || "",
    };

    purchaseOrder.attachments.push(attachment);
    await purchaseOrder.save();

    console.log("✅ Attachment added successfully:", attachment.originalName);

    res.status(201).json({
      success: true,
      message: "Attachment added successfully",
      data: attachment,
    });
  } catch (error) {
    console.error("❌ Attachment upload error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET ALL PURCHASE ORDERS (read)
 * oemPrice also included in response for each item.
 */
const getAllPurchaseOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      leadId,
      startDate,
      endDate,
      licenseType,
    } = req.query;

    const filter = {
      superAdminId: getSuperAdminId(req),
      poType: "base",
    };

    // Record-based access for list
    const isSuperAdmin = req.admin.systemrole === "SuperAdmin";
    if (!isSuperAdmin) {
      filter.$or = [
        { createdBy: req.admin.id },
        { "assignedUsers.user": req.admin.id },
      ];
    }

    if (status) filter.status = status;
    if (leadId) filter.leadId = leadId;

    if (startDate || endDate) {
      filter.poDate = {};
      if (startDate) filter.poDate.$gte = new Date(startDate);
      if (endDate) filter.poDate.$lte = new Date(endDate);
    }

    if (licenseType) {
      filter["items.licenseType"] = licenseType;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch POs
    const purchaseOrders = await PurchaseOrder.find(filter)
      .populate("leadId", "customerName contactPerson email")
      .populate("quotationId", "quoteId totalQuoteValue")
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email")
      .sort({ poDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PurchaseOrder.countDocuments(filter);

    // If oemPrice needs to be populated, ensure this is always in the output for each item
    const dataWithOemPrice = purchaseOrders.map(po => {
      const plainPO = po.toObject();
      plainPO.items = Array.isArray(plainPO.items)
        ? plainPO.items.map(item => ({
            ...item,
            oemPrice: item.oemPrice !== undefined ? item.oemPrice : undefined
          }))
        : [];
      return plainPO;
    });

    res.json({
      success: true,
      data: dataWithOemPrice,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("❌ Get purchase orders error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET PURCHASE ORDER BY ID (read)
 * oemPrice also included in response for each item.
 */
const getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
    })
      .populate("leadId")
      .populate("quotationId")
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email");

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    if (!canAccessPurchaseOrder(purchaseOrder, req.admin, "read")) {
      return res.status(403).json({
        success: false,
        error: "You do not have access to this purchase order",
      });
    }

    // Explicitly include oemPrice for each item in the returned data
    const poData = purchaseOrder.toObject();
    poData.items = Array.isArray(poData.items)
      ? poData.items.map(item => ({
          ...item,
          oemPrice: item.oemPrice !== undefined ? item.oemPrice : undefined
        }))
      : [];

    res.json({
      success: true,
      data: poData,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * UPDATE PURCHASE ORDER STATUS (update)
 */
const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
    });

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    if (!canAccessPurchaseOrder(purchaseOrder, req.admin, "update")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to update this purchase order",
      });
    }

    if (status) {
      purchaseOrder.status = status;

      if (status === "sent") {
        purchaseOrder.sentDate = new Date();
      } else if (status === "acknowledged") {
        purchaseOrder.acknowledgedDate = new Date();
      } else if (status === "completed") {
        purchaseOrder.completedDate = new Date();
      }
    }

    await purchaseOrder.save();
    await purchaseOrder.populate("leadId", "customerName contactPerson email");
    await purchaseOrder.populate("quotationId", "quoteId totalQuoteValue");
    await purchaseOrder.populate("createdBy", "name email");
    await purchaseOrder.populate("assignedUsers.user", "name email");

    // Ensure oemPrice is included in response items
    const poData = purchaseOrder.toObject();
    poData.items = Array.isArray(poData.items)
      ? poData.items.map(item => ({
          ...item,
          oemPrice: item.oemPrice !== undefined ? item.oemPrice : undefined
        }))
      : [];

    res.json({
      success: true,
      message: "Purchase order status updated successfully",
      data: poData,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET PURCHASE ORDERS BY LEAD (read)
 * oemPrice also included in response for each item.
 */
const getPurchaseOrdersByLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const isSuperAdmin = req.admin.systemrole === "SuperAdmin";

    const conditions = { leadId, superAdminId: getSuperAdminId(req) };

    if (!isSuperAdmin) {
      conditions.$or = [
        { createdBy: req.admin.id },
        { "assignedUsers.user": req.admin.id },
      ];
    }

    const purchaseOrders = await PurchaseOrder.find(conditions)
      .populate("quotationId", "quoteId totalQuoteValue")
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email")
      .sort({ poDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PurchaseOrder.countDocuments(conditions);

    // Ensure oemPrice included per item
    const dataWithOemPrice = purchaseOrders.map(po => {
      const plainPO = po.toObject();
      plainPO.items = Array.isArray(plainPO.items)
        ? plainPO.items.map(item => ({
            ...item,
            oemPrice: item.oemPrice !== undefined ? item.oemPrice : undefined
          }))
        : [];
      return plainPO;
    });

    res.json({
      success: true,
      data: dataWithOemPrice,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * DELETE PURCHASE ORDER (delete)
 */
const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ Deleting purchase order:", id);

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: id,
      superAdminId: getSuperAdminId(req),
    });
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    if (!canAccessPurchaseOrder(purchaseOrder, req.admin, "delete")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to delete this purchase order",
      });
    }

    if (purchaseOrder.poPdf && purchaseOrder.poPdf.s3Key) {
      try {
        await deleteFileFromS3(purchaseOrder.poPdf.s3Key);
      } catch (s3Error) {
        console.error("⚠️ Failed to delete PO PDF from S3:", s3Error.message);
      }
    }

    if (purchaseOrder.attachments && purchaseOrder.attachments.length > 0) {
      for (const attachment of purchaseOrder.attachments) {
        try {
          await deleteFileFromS3(attachment.s3Key);
        } catch (s3Error) {
          console.error(
            "⚠️ Failed to delete attachment from S3:",
            s3Error.message
          );
        }
      }
    }

    await PurchaseOrder.deleteOne({
      _id: id,
      superAdminId: getSuperAdminId(req),
    });

    console.log(
      "✅ Purchase order deleted successfully:",
      purchaseOrder.poNumber
    );

    res.json({
      success: true,
      message: "Purchase order deleted successfully",
      data: {
        id: purchaseOrder._id,
        poNumber: purchaseOrder.poNumber,
        customerName: purchaseOrder.customerDetails.customerName,
      },
    });
  } catch (error) {
    console.error("❌ Purchase order deletion error:", error);

    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET EXPIRING LICENSES (read – record-based)
 */
const getExpiringLicenses = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const allPOs = await PurchaseOrder.findWithExpiringLicenses(parseInt(days));

    // Filter by record-based access
    const visiblePOs = allPOs
    .filter(po => isSameId(po.superAdminId, getSuperAdminId(req)))
    .filter((po) =>
      canAccessPurchaseOrder(po, req.admin, "read")
    );

    // Map to ensure oemPrice included per item
    const dataWithOemPrice = visiblePOs.map(po => {
      const plainPO = po.toObject ? po.toObject() : po;
      plainPO.items = Array.isArray(plainPO.items)
        ? plainPO.items.map(item => ({
            ...item,
            oemPrice: item.oemPrice !== undefined ? item.oemPrice : undefined
          }))
        : [];
      return plainPO;
    });

    res.json({
      success: true,
      data: dataWithOemPrice,
      summary: {
        total: dataWithOemPrice.length,
        days: parseInt(days),
      },
    });
  } catch (error) {
    console.error("❌ Get expiring licenses error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET PURCHASE ORDER STATS (read – record-based)
 */
const getPurchaseOrdersStats = async (req, res) => {
  try {
    console.log("📊 Fetching Purchase Order stats...");

    const tenantId = getSuperAdminId(req);

    // 🔐 Tenant boundary (MANDATORY)
    const tenantMatch = {
      superAdminId: new mongoose.Types.ObjectId(tenantId),
    };

    // 🔐 Record-level restriction
    const recordMatch =
      req.admin.systemrole === "SuperAdmin"
        ? {}
        : {
            $or: [
              { createdBy: req.admin._id },
              { "assignedUsers.user": req.admin._id },
            ],
          };

    const matchStage = {
      ...tenantMatch,
      ...recordMatch,
    };

    /* ------------------------------------------------------------------ */
    /*                           PO COUNTS BY TYPE                         */
    /* ------------------------------------------------------------------ */

    const poTypeCounts = await PurchaseOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$poType",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalBasePOs =
      poTypeCounts.find((p) => p._id === "base")?.count || 0;

    const totalSalesPOs =
      poTypeCounts.find((p) => p._id === "sales")?.count || 0;

    /* ------------------------------------------------------------------ */
    /*                         STATUS COUNTS (BASE PO ONLY)                */
    /* ------------------------------------------------------------------ */

    const statusCounts = await PurchaseOrder.aggregate([
      {
        $match: {
          ...matchStage,
          poType: "base",
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const status = {
      totalDraft: statusCounts.find((s) => s._id === "draft")?.count || 0,
      totalSent: statusCounts.find((s) => s._id === "sent")?.count || 0,
      totalAcknowledged:
        statusCounts.find((s) => s._id === "acknowledged")?.count || 0,
      totalInProgress:
        statusCounts.find((s) => s._id === "in_progress")?.count || 0,
      totalCompleted:
        statusCounts.find((s) => s._id === "completed")?.count || 0,
      totalCancelled:
        statusCounts.find((s) => s._id === "cancelled")?.count || 0,
    };

    /* ------------------------------------------------------------------ */
    /*                         AMOUNT CALCULATIONS                         */
    /* ------------------------------------------------------------------ */

    const amountAgg = await PurchaseOrder.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$poType",
          amountSum: { $sum: "$totalAmount" },
        },
      },
    ]);

    const baseAmountSum =
      amountAgg.find((a) => a._id === "base")?.amountSum || 0;

    const salesAmountSum =
      amountAgg.find((a) => a._id === "sales")?.amountSum || 0;

    const totalProfit = baseAmountSum - salesAmountSum;

    /* ------------------------------------------------------------------ */
    /*                         LICENSE STATS (BASE PO)                     */
    /* ------------------------------------------------------------------ */

    const now = new Date();
    const next30Days = new Date(Date.now() + 30 * 86400000);

    const expiredLicenses = await PurchaseOrder.countDocuments({
      ...matchStage,
      poType: "base",
      "items.licenseExpiryDate": { $lt: now },
    });

    const expiringSoonLicenses = await PurchaseOrder.countDocuments({
      ...matchStage,
      poType: "base",
      "items.licenseExpiryDate": { $gte: now, $lte: next30Days },
    });

    /* ------------------------------------------------------------------ */
    /*                               RESPONSE                              */
    /* ------------------------------------------------------------------ */

    res.json({
      success: true,
      data: {
        totalPOs: {
          base: totalBasePOs,
          sales: totalSalesPOs,
          overall: totalBasePOs + totalSalesPOs,
        },
        status,
        financials: {
          baseAmountSum,
          salesAmountSum,
          totalProfit,
        },
        licenses: {
          expired: expiredLicenses,
          expiringSoon: expiringSoonLicenses,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error fetching PO stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


const createSalesPOFromExistingPO = async (req, res) => {
  try {
    const { basePoId } = req.params;
    const { poNumber, poDate, paymentTerms, amcPeriod, rewardId } = req.body;

    const tenantId = getSuperAdminId(req);

    // 1️⃣ Fetch BASE PO (tenant safe)
    const basePO = await PurchaseOrder.findOne({
      _id: basePoId,
      superAdminId: tenantId,
      poType: "base",
    });

    if (!basePO) {
      return res.status(404).json({
        success: false,
        error: "Base Purchase Order not found",
      });
    }

    // 2️⃣ Prevent duplicate Sales PO
    const alreadyExists = await PurchaseOrder.findOne({
      parentPoId: basePO._id,
      poType: "sales",
    });

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        error: "Sales PO already exists for this Purchase Order",
      });
    }

    // 3️⃣ Create SALES PO
    const salesPO = await PurchaseOrder.create({
      poNumber,
      poDate: poDate || new Date(),

      poType: "sales",
      parentPoId: basePO._id,

      leadId: basePO.leadId,
      quotationId: basePO.quotationId,
      accountId: basePO.accountId,

      customerDetails: basePO.customerDetails,
      items: basePO.items,

      paymentTerms,
      amcPeriod,
      rewardId,

      totalAmount: basePO.totalAmount,
      currency: basePO.currency,

      superAdminId: tenantId,
      createdBy: req.admin.id,
    });

    res.status(201).json({
      success: true,
      message: "Sales PO created successfully",
      data: salesPO,
    });
  } catch (error) {
    console.error("❌ Create Sales PO Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updatePurchaseOrderItemLicense = async (req, res) => {
  try {
    const { poId, itemId } = req.params;
    const { licenseType, licenseExpiryDate } = req.body;

    if (!licenseType && !licenseExpiryDate) {
      return res.status(400).json({
        success: false,
        error: "At least one of licenseType or licenseExpiryDate must be provided",
      });
    }

    const purchaseOrder = await PurchaseOrder.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
    });


    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    if (!canAccessPurchaseOrder(purchaseOrder, req.admin, "update")) {
      return res.status(403).json({
        success: false,
        error: "You do not have permission to update this purchase order",
      });
    }

    const item = purchaseOrder.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        error: "Item not found in purchase order",
      });
    }

    if (licenseType !== undefined) {
      item.licenseType = licenseType;
    }
    if (licenseExpiryDate !== undefined) {
      const date = licenseExpiryDate ? new Date(licenseExpiryDate) : null;
      if (date && isNaN(date.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid licenseExpiryDate",
        });
      }
      item.licenseExpiryDate = date;
    }

    await purchaseOrder.save();

    // Ensure oemPrice present in returned item
    const itemObj = item.toObject ? item.toObject() : item;
    itemObj.oemPrice = itemObj.oemPrice !== undefined ? itemObj.oemPrice : undefined;

    res.json({
      success: true,
      message: "Purchase order item updated successfully",
      data: itemObj,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export {
  createPurchaseOrder,
  addAttachment,
  getAllPurchaseOrders,
  updatePurchaseOrderItemLicense,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  getPurchaseOrdersByLead,
  deletePurchaseOrder,
  getExpiringLicenses,
  getPurchaseOrdersStats,
  createSalesPOFromExistingPO
};
