import Account from "../models/Account.js";
import Lead from "../models/Lead.js";
import Quotation from "../models/Quotation.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { getSuperAdminId } from "../utils/superAdmin.js";

/**
 * CREATE ACCOUNT
 */
export const createAccount = async (req, res) => {
  try {
    const account = await Account.create({
      ...req.body,
      createdBy: req.admin.id,
      superAdminId: req.admin.superAdminId || req.admin.id,
    });

    res.status(201).json({
      success: true,
      message: "Account created successfully",
      data: account,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Account already exists with this email",
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET ALL ACCOUNTS (Search + Pagination)
 */

export const getAllAccounts = async (req, res) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const tenantId = req.admin.superAdminId || req.admin._id;
  
      const andConditions = [
        { superAdminId: tenantId },
        { isDeleted: false }   // ✅ hide deleted accounts
      ];
  
      if (search) {
        andConditions.push({
          $or: [
            { customerName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phoneNumber: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
          ],
        });
      }
  
      const filter = { $and: andConditions };
  
      const pageNum = Number(page);
      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;
  
      const [data, total] = await Promise.all([
        Account.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Account.countDocuments(filter),
      ]);
  
      res.json({
        success: true,
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("❌ getAllAccounts error", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };
  


/**
 * GET ACCOUNT BY ID
 */
export const getAccountById = async (req, res) => {
  try {
    const account = await Account.findOne({
      _id: req.params.id,
      superAdminId: req.admin.superAdminId || req.admin.id,
      isDeleted: false,
    }).populate("createdBy", "name email");

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Account not found",
      });
    }

    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * UPDATE ACCOUNT
 */
export const updateAccount = async (req, res) => {
  try {
    const account = await Account.findOneAndUpdate(
      {
        _id: req.params.id,
        superAdminId: req.admin.superAdminId || req.admin.id,
        isDeleted: false,
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Account not found",
      });
    }

    res.json({
      success: true,
      message: "Account updated successfully",
      data: account,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE ACCOUNT (SOFT DELETE)
 */
export const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findOneAndUpdate(
      {
        _id: req.params.id,
        superAdminId: req.admin.superAdminId || req.admin.id,
      },
      { isDeleted: true },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Account not found",
      });
    }

    res.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET RELATED DATA BY ACCOUNT ID (Leads, Quotations, Purchase Orders)
 */
export const getAccountRelatedData = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const tenantId = req.admin.superAdminId || req.admin.id;

    // Verify account exists and belongs to tenant
    const account = await Account.findOne({
      _id: id,
      superAdminId: tenantId,
      isDeleted: false,
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: "Account not found",
      });
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Base filter for accountId and tenant
    const baseFilter = {
      accountId: id,
      superAdminId: tenantId,
    };

    // Record-level access filter for non-SuperAdmin
    let leadsFilter = { ...baseFilter };
    let purchaseOrdersFilter = { ...baseFilter };

    if (req.admin.systemrole !== "SuperAdmin") {
      const accessFilter = {
        $or: [
          { createdBy: req.admin.id },
          {
            assignedUsers: {
              $elemMatch: {
                user: req.admin.id,
                "permissions.read": true,
              },
            },
          },
        ],
      };

      leadsFilter = { ...baseFilter, ...accessFilter };
      purchaseOrdersFilter = { ...baseFilter, ...accessFilter };
    }

    // First, get all lead IDs that belong to this account
    const leadsForAccount = await Lead.find(leadsFilter).select("_id");
    const leadIds = leadsForAccount.map((lead) => lead._id);

    // Quotations filter: quotations with accountId OR quotations linked to leads with this accountId
    let quotationsFilter = {
      superAdminId: tenantId,
      $or: [
        { accountId: id }, // Direct accountId match
        { leadId: { $in: leadIds } }, // Linked through lead
      ],
    };

    // Apply record-level access for quotations
    if (req.admin.systemrole !== "SuperAdmin") {
      const accessFilter = {
        $or: [
          { createdBy: req.admin.id },
          {
            assignedUsers: {
              $elemMatch: {
                user: req.admin.id,
                "permissions.read": true,
              },
            },
          },
        ],
      };
      quotationsFilter = {
        $and: [
          {
            superAdminId: tenantId,
            $or: [
              { accountId: id },
              { leadId: { $in: leadIds } },
            ],
          },
          accessFilter,
        ],
      };
    }

    // Fetch related data in parallel
    const [leads, leadsTotal, quotations, quotationsTotal, purchaseOrders, purchaseOrdersTotal] = await Promise.all([
      // Leads
      Lead.find(leadsFilter)
        .populate("createdBy", "name email")
        .populate("assignedUsers.user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Lead.countDocuments(leadsFilter),

      // Quotations - now includes those linked through leads
      Quotation.find(quotationsFilter)
        .populate("leadId", "customerName contactPerson email accountId")
        .populate("createdBy", "name email")
        .populate("assignedUsers.user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Quotation.countDocuments(quotationsFilter),

      // Purchase Orders
      PurchaseOrder.find(purchaseOrdersFilter)
        .populate("leadId", "customerName contactPerson email")
        .populate("quotationId", "quoteId totalQuoteValue")
        .populate("createdBy", "name email")
        .populate("assignedUsers.user", "name email")
        .sort({ poDate: -1 })
        .skip(skip)
        .limit(limitNum),
      PurchaseOrder.countDocuments(purchaseOrdersFilter),
    ]);

    res.json({
      success: true,
      data: {
        leads: {
          data: leads,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: leadsTotal,
            totalPages: Math.ceil(leadsTotal / limitNum),
          },
        },
        quotations: {
          data: quotations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: quotationsTotal,
            totalPages: Math.ceil(quotationsTotal / limitNum),
          },
        },
        purchaseOrders: {
          data: purchaseOrders,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: purchaseOrdersTotal,
            totalPages: Math.ceil(purchaseOrdersTotal / limitNum),
          },
        },
      },
    });
  } catch (error) {
    console.error("❌ getAccountRelatedData error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
