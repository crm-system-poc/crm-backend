import Admin from "../models/Admin.js";
import { getSuperAdminId } from "../utils/superAdmin.js";

const createUser = async (req, res) => {
  try {
    if (req.admin.systemrole !== "SuperAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { name, email, phone, password, permissions, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Name, email & password are required",
      });
    }

    const existingEmail = await Admin.findOne({
      email,
      superAdminId: getSuperAdminId(req),
    });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already exists" });
    }

    if (phone) {
      const existingphone = await Admin.findOne({
        phone,
        superAdminId: getSuperAdminId(req),
      });
      if (existingphone) {
        return res.status(400).json({ error: "phone already exists" });
      }
    }

    const user = await Admin.create({
      name,
      email,
      phone,
      password,
      systemrole: "User",
      role: role,
      permissions: permissions || {},
      superAdminId: getSuperAdminId(req),
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

const getAllUsers = async (req, res) => {
  const users = await Admin.find({
    systemrole: "User",
    superAdminId: getSuperAdminId(req),
  });
  res.json(users);
};

const updatePermissions = async (req, res) => {
  try {
    if (req.admin.systemrole !== "SuperAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { permissions, role } = req.body;

    if (!permissions && !role) {
      return res.status(400).json({
        success: false,
        message: "Permissions or role data is required",
      });
    }

    const userId = req.params.id;

    const updateFields = {};
    if (permissions) updateFields.permissions = permissions;
    if (role) updateFields.role = role;

    const user = await Admin.findOneAndUpdate(
      {
        _id: userId,
        systemrole: "User",
        superAdminId: getSuperAdminId(req),
      },
      updateFields,
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "User updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    if (req.admin.systemrole !== "SuperAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const user = await Admin.findOne({
      _id: req.params.id,
      systemrole: "User",
      superAdminId: getSuperAdminId(req),
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const deleteUserById = async (req, res) => {
  try {
    if (req.admin.systemrole !== "SuperAdmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const deletedUser = await Admin.findOneAndDelete({
      _id: req.params.id,
      systemrole: "User",
      superAdminId: getSuperAdminId(req),
    });

    if (!deletedUser)
      return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export {
  createUser,
  getAllUsers,
  getUserById,
  updatePermissions,
  deleteUserById,
};
