import Quotation from "../models/Quotation.js";
import Lead from "../models/Lead.js";
import { uploadToS3 } from "../utils/s3Utils.js";
import { getSuperAdminId } from "../utils/superAdmin.js";

// Helper to compare ObjectId / string consistently
export const isSameId = (a, b) => {
  if (!a || !b) return false;
  const aStr =
    typeof a === "string" ? a : a._id ? a._id.toString() : a.toString();
  const bStr =
    typeof b === "string" ? b : b._id ? b._id.toString() : b.toString();
  return aStr === bStr;
};

// 🔐 Common per-quotation access check
// action: "read" | "update" | "delete"
export const canAccessQuotation = (quotation, admin, action) => {
  if (!quotation || !admin) return false;

  // 1️⃣ SuperAdmin - full access
  if (admin.systemrole === "SuperAdmin") return true;

  // 2️⃣ Creator always full permission
  if (isSameId(quotation.createdBy, admin.id)) return true;

  // 3️⃣ Assigned Users Permission
  const assignedEntry = (quotation.assignedUsers || []).find((u) =>
    isSameId(u.user, admin.id)
  );

  if (!assignedEntry || !assignedEntry.permissions) return false;

  return assignedEntry.permissions[action] === true;
};

const getQuotationStats = async (req, res) => {
  try {
    console.log("📊 Fetching quotation stats…");
    const AdminId = getSuperAdminId(req);

    const totalQuotations = await Quotation.countDocuments({
      superAdminId: AdminId,
    });

    const trendData = await Quotation.aggregate([
      {
        $match: { superAdminId: AdminId },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          quotations: { $sum: 1 },
        },
      },
      { $sort: { "_id": 1 } },
    ]);
    
    const formattedTrend = trendData.map((q) => ({
      month: q._id,
      quotations: q.quotations,
    }));

    const totalPending = await Quotation.countDocuments({
      status: "draft",
      superAdminId: AdminId,
    });

    const totalApproved = await Quotation.countDocuments({
      status: "accepted",
      superAdminId: AdminId,
    });

    const totalRejected = await Quotation.countDocuments({
      status: "rejected",
      superAdminId: AdminId,
    });

    const totalExpired = await Quotation.countDocuments({
      status: "expired",
      superAdminId: AdminId,
    });

    // optional
    const totalWithPDF = await Quotation.countDocuments({
      pdfFile: { $exists: true },
    });
    const totalWithoutPDF = await Quotation.countDocuments({
      pdfFile: { $exists: false },
    });
    const totalData = await Quotation.aggregate([
      { $match: { superAdminId: AdminId } },
      { $group: { _id: null, totalGrand: { $sum: "$grandTotal" } } },
    ]);

    const totalGrandValue = totalData.length > 0 ? totalData[0].totalGrand : 0;
    res.json({
      success: true,
      data: {
        totalQuotations,
        totalPending,
        totalApproved,
        totalRejected,
        totalExpired,
        totalWithPDF,
        totalWithoutPDF,
        totalGrandValue,
        trendData: formattedTrend
      },
    });
  } catch (error) {
    console.error("❌ Error fetching quotation stats:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createQuotation = async (req, res) => {
  try {
    const {
      leadId,
      items,
      taxRate = 18,
      validityDays = 30,
      notes,
      termsAndConditions,

      customerName,
      contactPerson,
      email,
      phoneNumber,
      address,

      pdfFile,
    } = req.body;

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: "Lead not found" });
    }

    if (
      !customerName ||
      !contactPerson ||
      !email ||
      !phoneNumber ||
      !address
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Missing/required customer fields: Customer Name, Contact Person, Email, Phone Number, Address",
      });
    }

    const parsedItems =
      typeof items === "string" ? JSON.parse(items) : items;

    const calculatedItems = parsedItems.map((i) => ({
      ...i,
      total: Number(i.unitPrice) * Number(i.quantity),
    }));

    const totalQuoteValue = calculatedItems.reduce(
      (sum, i) => sum + i.total,
      0
    );

    let parsedPdfFile;

    if (pdfFile) {
      const raw =
        typeof pdfFile === "string" && pdfFile.startsWith("{")
          ? JSON.parse(pdfFile)
          : null;
    
      if (raw) {
        parsedPdfFile = {
          s3Key: raw.key,
          s3Url: raw.url,
          originalName: raw.originalName,
          fileSize: raw.fileSize,
        };
      }
    }
    

    const quotation = await Quotation.create({
      leadId,
      createdBy: req.admin.id,
      superAdminId: getSuperAdminId(req),

      customerDetails: {
        customerName,
        contactPerson,
        email,
        phoneNumber,
        address,
      },

      items: calculatedItems,
      totalQuoteValue,
      taxRate: Number(taxRate),
      notes,
      termsAndConditions,
      validityDays: Number(validityDays),
      validUntil: new Date(
        Date.now() + Number(validityDays) * 86400000
      ),

      // ✅ PDF STORED
      pdfFile: parsedPdfFile,
    });

    await quotation.populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Quotation created successfully",
      data: quotation,
    });
  } catch (error) {
    console.error("❌ Create quotation error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
     });
    if (!quotation)
      return res.status(404).json({ success: false, error: "Not found" });

    if (!canAccessQuotation(quotation, req.admin, "delete"))
      return res
        .status(403)
        .json({ success: false, error: "No permission to delete" });

    await quotation.deleteOne();

    res.json({ success: true, message: "Quotation deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
     })

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: "Quotation not found",
      });
    }

    if (!quotation.pdfFile) {
      return res.status(404).json({
        success: false,
        error: "PDF not found for this quotation",
      });
    }

    const s3 = await import("../config/aws.js");
    await s3.default
      .deleteObject({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: quotation.pdfFile.s3Key,
      })
      .promise();

    quotation.pdfFile = undefined;
    await quotation.save();

    res.json({
      success: true,
      message: "PDF deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAllQuotations = async (req, res) => {
  try {
    const isSuperAdmin = req.admin.systemrole === "SuperAdmin";

    const filter = {
      superAdminId: getSuperAdminId(req),
      };
      
      if (!isSuperAdmin) {
        filter.$or = [
          { createdBy: req.admin.id },
          { "assignedUsers.user": req.admin.id },
        ];
      }

    const quotations = await Quotation.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email")
      .sort({ createdAt: -1 });

    // filter out records user has no read permission on
    const visible = quotations.filter((q) =>
      canAccessQuotation(q, req.admin, "read")
    );

    res.json({ success: true, data: visible });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getQuotationById = async (req, res) => {
  try {
     const quotation = await Quotation.findOne({
       _id: req.params.id,
       superAdminId: getSuperAdminId(req),
      })
        .populate("createdBy", "name email")
        .populate("assignedUsers.user", "name email")
        .populate("leadId");

    if (!quotation)
      return res.status(404).json({ success: false, error: "Not found" });

    if (!canAccessQuotation(quotation, req.admin, "read"))
      return res.status(403).json({
        success: false,
        error: "No permission to view this quotation",
      });

    res.json({ success: true, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateQuotationStatus = async (req, res) => {
  try {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      superAdminId: getSuperAdminId(req),
     });

    if (!quotation)
      return res.status(404).json({ success: false, error: "Not found" });

    if (!canAccessQuotation(quotation, req.admin, "update"))
      return res
        .status(403)
        .json({ success: false, error: "No permission to update" });

    quotation.status = req.body.status;
    await quotation.save();

    res.json({ success: true, message: "Status updated", data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getQuotationsByLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const isSuperAdmin = req.admin.systemrole === "SuperAdmin";

    const conditions = {
      leadId,
      superAdminId: getSuperAdminId(req),
      ...(isSuperAdmin ? {} : { createdBy: req.admin.id }),
    };

    const quotations = await Quotation.find(conditions)
      .populate("createdBy", "name email")
      .sort({ dateOfQuote: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Quotation.countDocuments(conditions);

    // const quotations = await Quotation.find({ leadId })
    //   .populate("createdBy", "name email")
    //   .sort({ dateOfQuote: -1 })
    //   .skip(skip)
    //   .limit(limitNum);

    // const total = await Quotation.countDocuments({ leadId });

    res.json({
      success: true,
      data: quotations,
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

export {
  createQuotation,
  deleteQuotation,
  deleteQuotationPDF,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  getQuotationsByLead,
  getQuotationStats,
};
