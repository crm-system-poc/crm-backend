import PurchaseOrder from "../models/PurchaseOrder.js";
import { getSuperAdminId } from "../utils/superAdmin.js";
import { deleteFileFromS3 } from "../utils/s3Utils.js";
import mongoose from "mongoose";

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

const extractId = (val) => {
  if (!val) return null;
  if (typeof val === "string") return val;
  if (val._id) return val._id;
  if (val.id) return val.id;
  return null;
};

const isSameId = (a, b) => {
  if (!a || !b) return false;
  return a.toString() === b.toString();
};

const canAccessSalesPO = (po, admin, action) => {
  if (!po || !admin) return false;

  if (admin.systemrole === "SuperAdmin") return true;
  if (isSameId(po.createdBy, admin.id)) return true;

  const assigned = (po.assignedUsers || []).find((u) =>
    isSameId(u.user, admin.id)
  );

  return assigned?.permissions?.[action] === true;
};

/* -------------------------------------------------------
   GET ALL SALES POs
------------------------------------------------------- */

export async function getAllSalesPOs(req, res) {
  try {
    const { page = 1, limit = 10, search, status } = req.query;

    const filter = {
      superAdminId: getSuperAdminId(req),
      poType: "sales",
    };

    if (search) {
      filter.$or = [
        { poNumber: { $regex: search, $options: "i" } },
        { "customerDetails.customerName": { $regex: search, $options: "i" } },
      ];
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    if (req.admin.systemrole !== "SuperAdmin") {
      filter.$and = [
        {
          $or: [
            { createdBy: req.admin._id },
            { "assignedUsers.user": req.admin._id },
          ],
        },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate("parentPoId", "poNumber")
        .populate("accountId", "customerName email phoneNumber")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      PurchaseOrder.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("❌ getAllSalesPOs error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};


/* -------------------------------------------------------
   GET SALES PO BY ID
------------------------------------------------------- */
export async function getSalesPOById(req, res) {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      poType: "sales",
      superAdminId: getSuperAdminId(req),
    })
      .populate("parentPoId", "poNumber")
      .populate("leadId", "customerName contactPerson email")
      .populate("quotationId", "quoteId totalQuoteValue")
      .populate("accountId", "customerName email phoneNumber")
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email");

    if (!po) {
      return res.status(404).json({
        success: false,
        error: "Sales PO not found",
      });
    }

    if (!canAccessSalesPO(po, req.admin, "read")) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    // Add oemPrice in each item (if not present, return as 0)
    let poObj = po.toObject ? po.toObject() : po;
    if (Array.isArray(poObj.items)) {
      poObj.items = poObj.items.map(item => ({
        ...item,
        oemPrice: typeof item.oemPrice !== "undefined" ? item.oemPrice : 0
      }));
    }

    res.json({
      success: true,
      data: poObj,
    });
  } catch (err) {
    console.error("❌ getSalesPOById error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/* -------------------------------------------------------
   CREATE SALES PO (FROM BASE PO)
------------------------------------------------------- */

export async function createSalesPO(req, res) {
  try {
    const {
      poNumber,
      poDate,
      parentPoId,
      items,
      paymentTerms,
      deliveryTerms,
      notes,
      amcPeriod,
      rewardId,
    } = req.body;

    if (!poNumber) {
      return res.status(400).json({
        success: false,
        error: "PO Number is required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one item is required",
      });
    }

    const tenantId = getSuperAdminId(req);

    // Unique PO Number check
    const exists = await PurchaseOrder.findOne({
      poNumber: poNumber.toUpperCase(),
      superAdminId: tenantId,
    });

    if (exists) {
      return res.status(400).json({
        success: false,
        error: "PO Number already exists",
      });
    }

    // Validate Base PO
    if (!mongoose.Types.ObjectId.isValid(parentPoId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid Base PO ID",
      });
    }

    const basePO = await PurchaseOrder.findOne({
      _id: parentPoId,
      superAdminId: tenantId,
      poType: "base",
    });

    if (!basePO) {
      return res.status(404).json({
        success: false,
        error: "Base PO not found",
      });
    }

    // Prevent duplicate Sales PO
    const existingSalesPO = await PurchaseOrder.findOne({
      parentPoId: basePO._id,
      poType: "sales",
      superAdminId: tenantId,
    });

    if (existingSalesPO) {
      return res.status(400).json({
        success: false,
        error: "Sales PO already exists for this Base PO",
      });
    }

    // Calculate items
    const calculatedItems = items.map((item) => ({
      productId: item.productId,
      description: item.description,
      quantity: Number(item.quantity),
      licenseType: item.licenseType,
      licenseExpiryDate: item.licenseExpiryDate
        ? new Date(item.licenseExpiryDate)
        : undefined,
      unitPrice: Number(item.unitPrice || 0),

      // Include oemPrice if provided
      oemPrice: typeof item.oemPrice !== "undefined" ? Number(item.oemPrice) : 0,

      totalPrice: Number(item.unitPrice || 0) * Number(item.quantity || 0),
    }));

    const totalAmount = calculatedItems.reduce(
      (sum, i) => sum + i.totalPrice,
      0
    );

    const salesPO = await PurchaseOrder.create({
      poNumber: poNumber.toUpperCase(),
      poDate: poDate ? new Date(poDate) : new Date(),
      poType: "sales",

      parentPoId: basePO._id,
      leadId: basePO.leadId,
      quotationId: basePO.quotationId,
      accountId: basePO.accountId,
      customerDetails: basePO.customerDetails,

      items: calculatedItems,
      totalAmount,

      paymentTerms,
      deliveryTerms,
      notes,
      amcPeriod,
      rewardId,

      status: "draft",
      currency: "INR",

      assignedUsers: basePO.assignedUsers || [],
      superAdminId: tenantId,
      createdBy: req.admin.id,
    });

    res.status(201).json({
      success: true,
      message: "Sales PO created successfully",
      data: salesPO,
    });
  } catch (err) {
    console.error("❌ Create Sales PO error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* -------------------------------------------------------
   UPDATE SALES PO
------------------------------------------------------- */

export async function updateSalesPO(req, res) {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      poType: "sales",
      superAdminId: getSuperAdminId(req),
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        error: "Sales PO not found",
      });
    }

    if (!canAccessSalesPO(po, req.admin, "update")) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    const allowedFields = [
      "poDate",
      "items",
      "paymentTerms",
      "deliveryTerms",
      "notes",
      "status",
      "amcPeriod",
      "rewardId",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // For items, handle oemPrice (if present) to allow updates
        if (field === "items" && Array.isArray(req.body.items)) {
          po.items = req.body.items.map(item => ({
            ...item,
            oemPrice: typeof item.oemPrice !== "undefined" ? Number(item.oemPrice) : 0,
          }));
        } else {
          po[field] = req.body[field];
        }
      }
    });

    await po.save();

    res.json({
      success: true,
      message: "Sales PO updated successfully",
      data: po,
    });
  } catch (err) {
    console.error("❌ Update Sales PO error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* -------------------------------------------------------
   DELETE SALES PO
------------------------------------------------------- */

export async function deleteSalesPO(req, res) {
  try {
    const po = await PurchaseOrder.findOne({
      _id: req.params.id,
      poType: "sales",
      superAdminId: getSuperAdminId(req),
    });

    if (!po) {
      return res.status(404).json({
        success: false,
        error: "Sales PO not found",
      });
    }

    if (!canAccessSalesPO(po, req.admin, "delete")) {
      return res.status(403).json({
        success: false,
        error: "Permission denied",
      });
    }

    if (po.attachments?.length) {
      for (const att of po.attachments) {
        if (att.s3Key) {
          await deleteFileFromS3(att.s3Key);
        }
      }
    }

    await po.deleteOne();

    res.json({
      success: true,
      message: "Sales PO deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete Sales PO error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};



