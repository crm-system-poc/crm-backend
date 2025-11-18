import PurchaseOrder from "../models/PurchaseOrder.js";
import Lead from "../models/Lead.js";
import Quotation from "../models/Quotation.js";
import { uploadToS3, deleteFileFromS3 } from "../utils/s3Utils.js";

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
    } = req.body;

    console.log("📝 Creating purchase order with data:", {
      leadId,
      quotationId,
      itemsCount: items
        ? typeof items === "string"
          ? JSON.parse(items).length
          : items.length
        : 0,
      poDate,
    });

    if (!req.files || !req.files.poPdf || req.files.poPdf.length === 0) {
      return res.status(400).json({
        success: false,
        error: "PO PDF attachment is required",
      });
    }

    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: "Lead ID is required",
      });
    }

    const lead = await Lead.findById(leadId).populate(
      "createdBy",
      "name email"
    );
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    if (!items) {
      return res.status(400).json({
        success: false,
        error: "Items are required",
      });
    }

    const parsedItems = typeof items === "string" ? JSON.parse(items) : items;

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one item is required for purchase order",
      });
    }

    const itemErrors = [];
    parsedItems.forEach((item, index) => {
      if (!item.productId) {
        itemErrors.push(`Item ${index + 1}: Product ID is required`);
      }
      if (!item.description) {
        itemErrors.push(`Item ${index + 1}: Description is required`);
      }
      if (!item.quantity || item.quantity < 1) {
        itemErrors.push(`Item ${index + 1}: Valid quantity is required`);
      }
      if (!item.licenseType) {
        itemErrors.push(`Item ${index + 1}: License type is required`);
      }
      if (
        item.licenseType &&
        item.licenseType !== "perpetual" &&
        !item.licenseExpiryDate
      ) {
        itemErrors.push(
          `Item ${
            index + 1
          }: License expiry date is required for ${item.licenseType.toUpperCase()} license`
        );
      }

      if (
        item.licenseType &&
        item.licenseType !== "perpetual" &&
        item.licenseExpiryDate
      ) {
        const expiryDate = new Date(item.licenseExpiryDate);
        if (expiryDate <= new Date()) {
          itemErrors.push(
            `Item ${
              index + 1
            }: License expiry date must be in the future for ${item.licenseType.toUpperCase()} license`
          );
        }
      }
    });

    if (itemErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Item validation failed: " + itemErrors.join(", "),
      });
    }


    let validatedPODate = poDate ? new Date(poDate) : new Date();
    if (validatedPODate > new Date()) {
      return res.status(400).json({
        success: false,
        error: "PO Date cannot be in the future",
      });
    }


    if (quotationId) {
      const quotation = await Quotation.findById(quotationId);
      if (!quotation) {
        return res.status(404).json({
          success: false,
          error: "Quotation not found",
        });
      }
    }

    console.log("📁 PO PDF received:", req.files.poPdf[0].originalname);

    let poPdfData;
    try {
      const folder = `purchase-orders/${req.admin.id}`;
      const s3UploadResult = await uploadToS3(req.files.poPdf[0], folder);

      poPdfData = {
        originalName: s3UploadResult.originalName,
        s3Key: s3UploadResult.key,
        s3Url: s3UploadResult.url,
        fileSize: s3UploadResult.fileSize,
        uploadedAt: new Date(),
      };

      console.log("✅ PO PDF uploaded to S3:", s3UploadResult.key);
    } catch (uploadError) {
      console.error("❌ PO PDF upload failed:", uploadError);
      return res.status(500).json({
        success: false,
        error: "Failed to upload PO PDF: " + uploadError.message,
      });
    }

    const additionalAttachments = [];

    if (req.files.licenseFile && req.files.licenseFile.length > 0) {
      console.log("📄 Processing license file attachment");
      for (const file of req.files.licenseFile) {
        try {
          const folder = `purchase-orders/${req.admin.id}/attachments`;
          const s3UploadResult = await uploadToS3(file, folder);

          additionalAttachments.push({
            type: "license_file",
            originalName: s3UploadResult.originalName,
            s3Key: s3UploadResult.key,
            s3Url: s3UploadResult.url,
            fileSize: s3UploadResult.fileSize,
            uploadedAt: new Date(),
            notes: "License file uploaded during PO creation",
          });

          console.log("✅ License file uploaded:", s3UploadResult.originalName);
        } catch (uploadError) {
          console.error("⚠️ Failed to upload license file:", uploadError.message);
        }
      }
    }

    if (req.files.attachments && req.files.attachments.length > 0) {
      console.log(
        "📎 Processing additional attachments:",
        req.files.attachments.length
      );

      for (const file of req.files.attachments) {
        try {
          const folder = `purchase-orders/${req.admin.id}/attachments`;
          const s3UploadResult = await uploadToS3(file, folder);

          additionalAttachments.push({
            type: "other",
            originalName: s3UploadResult.originalName,
            s3Key: s3UploadResult.key,
            s3Url: s3UploadResult.url,
            fileSize: s3UploadResult.fileSize,
            uploadedAt: new Date(),
            notes: "",
          });

          console.log(
            "✅ Additional attachment uploaded:",
            s3UploadResult.originalName
          );
        } catch (uploadError) {
          console.error(
            "⚠️ Failed to upload additional attachment:",
            uploadError.message
          );
        
        }
      }
    }

    const poData = {
      leadId,
      quotationId,
      poDate: validatedPODate,
      customerDetails: {
        customerName: lead.customerName,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        address: lead.address,
      },
      items: parsedItems.map((item) => ({
        productId: item.productId,
        description: item.description,
        quantity: Number(item.quantity),
        licenseType: item.licenseType,
        licenseExpiryDate: item.licenseExpiryDate
          ? new Date(item.licenseExpiryDate)
          : undefined,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
        totalPrice: item.unitPrice
          ? Number(item.unitPrice) * Number(item.quantity)
          : 0,
      })),
      paymentTerms,
      deliveryTerms,
      notes,
      poPdf: poPdfData,
      attachments: additionalAttachments,
      createdBy: req.admin.id,
      totalAmount: parsedItems.reduce(
        (sum, item) =>
          sum +
          (item.unitPrice ? Number(item.unitPrice) * Number(item.quantity) : 0),
        0
      ),
    };

    console.log("🧮 Pre-calculated values:", {
      totalAmount: poData.totalAmount,
      itemsCount: poData.items.length,
      attachmentsCount: poData.attachments.length,
    });

    const poNumber = await PurchaseOrder.getNextPONumber();
    poData.poNumber = poNumber;
    console.log("🎫 Generated PO number:", poNumber);

    console.log("💾 Saving purchase order to database...");
    const purchaseOrder = await PurchaseOrder.create(poData);

    await purchaseOrder.populate("leadId", "customerName contactPerson email");
    await purchaseOrder.populate("quotationId", "quoteId totalQuoteValue");
    await purchaseOrder.populate("createdBy", "name email");

    console.log(
      "✅ Purchase order created successfully:",
      purchaseOrder.poNumber
    );

    res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data: purchaseOrder,
    });
  } catch (error) {
    console.error("❌ Purchase order creation error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      console.error("📋 Validation errors:", messages);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }

    if (error.name === "SyntaxError" && error.message.includes("JSON")) {
      return res.status(400).json({
        success: false,
        error: "Invalid items format. Please provide valid JSON array.",
      });
    }

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

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

    const purchaseOrder = await PurchaseOrder.findById(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
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

    const filter = {};

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

    const purchaseOrders = await PurchaseOrder.find(filter)
      .populate("leadId", "customerName contactPerson email")
      .populate("quotationId", "quoteId totalQuoteValue")
      .populate("createdBy", "name email")
      .sort({ poDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PurchaseOrder.countDocuments(filter);

    res.json({
      success: true,
      data: purchaseOrders,
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

const getPurchaseOrderById = async (req, res) => {
  try {
    const purchaseOrder = await PurchaseOrder.findById(req.params.id)
      .populate("leadId")
      .populate("quotationId")
      .populate("createdBy", "name email");

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    res.json({
      success: true,
      data: purchaseOrder,
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

const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const purchaseOrder = await PurchaseOrder.findById(req.params.id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
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

    res.json({
      success: true,
      message: "Purchase order status updated successfully",
      data: purchaseOrder,
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

const getPurchaseOrdersByLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const purchaseOrders = await PurchaseOrder.find({ leadId })
      .populate("quotationId", "quoteId totalQuoteValue")
      .populate("createdBy", "name email")
      .sort({ poDate: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await PurchaseOrder.countDocuments({ leadId });

    res.json({
      success: true,
      data: purchaseOrders,
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

const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("🗑️ Deleting purchase order:", id);

    const purchaseOrder = await PurchaseOrder.findById(id);

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        error: "Purchase order not found",
      });
    }

    if (purchaseOrder.createdBy.toString() !== req.admin.id) {
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

    await PurchaseOrder.findByIdAndDelete(id);

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

const getExpiringLicenses = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const purchaseOrders = await PurchaseOrder.findWithExpiringLicenses(
      parseInt(days)
    );

    res.json({
      success: true,
      data: purchaseOrders,
      summary: {
        total: purchaseOrders.length,
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


const getPurchaseOrdersStats = async (req, res) => {
  try {
    console.log("📊 Fetching Purchase Order stats...");

    const totalPOs = await PurchaseOrder.countDocuments();

    const totalDraft = await PurchaseOrder.countDocuments({ status: "draft" });
    const totalSent = await PurchaseOrder.countDocuments({ status: "sent" });
    const totalAcknowledged = await PurchaseOrder.countDocuments({ status: "acknowledged" });
    const totalInProgress = await PurchaseOrder.countDocuments({ status: "in_progress" });
    const totalCompleted = await PurchaseOrder.countDocuments({ status: "completed" });
    const totalCancelled = await PurchaseOrder.countDocuments({ status: "cancelled" });

    const totalWithPDF = await PurchaseOrder.countDocuments({ poPdf: { $exists: true } });
    const totalWithoutPDF = await PurchaseOrder.countDocuments({ poPdf: { $exists: false } });

    const totalData = await PurchaseOrder.aggregate([
      { $group: { _id: null, totalAmountSum: { $sum: "$totalAmount" } } }
    ]);

    const totalAmountSum = totalData.length > 0 ? totalData[0].totalAmountSum : 0;

    const now = new Date();
    const expiredLicenses = await PurchaseOrder.countDocuments({
      "items.licenseExpiryDate": { $lt: now }
    });

    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const expiringSoonLicenses = await PurchaseOrder.countDocuments({
      "items.licenseExpiryDate": {
        $gte: now,
        $lte: next30Days
      }
    });

    res.json({
      success: true,
      data: {
        totalPOs,
        status: {
          totalDraft,
          totalSent,
          totalAcknowledged,
          totalInProgress,
          totalCompleted,
          totalCancelled,
        },
        attachmentSummary: {
          totalWithPDF,
          totalWithoutPDF
        },
        licenses: {
          expired: expiredLicenses,
          expiringSoon: expiringSoonLicenses,
        },
        financials: {
          totalAmountSum
        }
      }
    });

  } catch (error) {
    console.error("❌ Error fetching PO stats:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};


export {
  createPurchaseOrder,
  addAttachment,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  getPurchaseOrdersByLead,
  deletePurchaseOrder,
  getExpiringLicenses,
  getPurchaseOrdersStats
  
};
