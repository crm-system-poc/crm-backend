// /admin model import
// Crud for SuperAdmin
// default SuperAdmin
import Admin from "../../models/Admin.js";
import {defaultPermissions} from "../../utils/defaultPermissions.js"

// Create Reseller SuperAdmin
export const createResellerSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const exists = await Admin.findOne({ email });
    if (exists)
      return res.status(400).json({
        success: false,
        error: "email already exists",
      });

    const existsPhone = await Admin.findOne({ phone });
    if (existsPhone)
      return res.status(400).json({
        success: false,
        error: "phone already exists",
      });

    // 1️⃣ Create the new reseller superadmin
    const resellerSA = await Admin.create({
      name,
      email,
      password,
      phone,
      systemrole: "SuperAdmin",
      superAdminId: null, // will update after creation
      role: "SuperAdmin",
      permissions: defaultPermissions,
    });

    
    await resellerSA.save();

    res.json({
      success: true,
      message: "Reseller SuperAdmin created",
      data: resellerSA,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get All SuperAdmins (Reseller Owners)
export const getAllResellerSuperAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({
      systemrole: "SuperAdmin",
      isActive: true,
    }).select("-password");

    res.json({ success: true, data: admins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get Single SuperAdmin
export const getResellerSuperAdminById = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      _id: req.params.id,
      systemrole: "SuperAdmin",
    }).select("-password");

    if (!admin)
      return res.status(404).json({
        success: false,
        error: "SuperAdmin not found",
      });

    res.json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Update SuperAdmin
export const updateResellerSuperAdmin = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const admin = await Admin.findOne({
      _id: req.params.id,
      systemrole: "SuperAdmin",
    });

    if (!admin)
      return res.status(404).json({
        success: false,
        error: "SuperAdmin not found",
      });

    if (name) admin.name = name;
    if (email) admin.email = email;
    if (phone) admin.phone = phone;

    await admin.save();

    res.json({
      success: true,
      message: "SuperAdmin updated",
      data: admin,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete SuperAdmin (Soft Delete Only)
export const deleteResellerSuperAdmin = async (req, res) => {
  try {
    const admin = await Admin.findOne({
      _id: req.params.id,
      systemrole: "SuperAdmin",
    });

    if (!admin)
      return res
        .status(404)
        .json({ success: false, error: "SuperAdmin not found" });

    admin.isActive = false;
    await admin.save();

    res.json({
      success: true,
      message: "SuperAdmin deactivated",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
