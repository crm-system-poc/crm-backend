import Account from "../models/Account.js";
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
