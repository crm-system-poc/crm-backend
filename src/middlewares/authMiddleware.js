import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";

export const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies.adminToken;

    if (!token && req.header("Authorization")) {
      token = req.header("Authorization").replace("Bearer ", "");
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔐 JWT decoded:", decoded);

    // Always load full admin with permissions
    const admin = await Admin.findById(decoded.id).select(
      "name email phone systemrole superAdminId isActive permissions lastLogin"
    );

    if (!admin) {
      res.clearCookie("adminToken");
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }

    // Make sure permissions exist
    admin.permissions = admin.permissions || {};

    req.admin = admin;
    res.setHeader("Cache-Control", "no-store");
    next();
  } catch (error) {
    res.clearCookie("adminToken");
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};

const getActionKey = (perm) => {
  const map = {
    managePlatformUsers: "platformUserActions",
    manageProducts: "productsActions",
    manageLeads: "leadsActions",
    manageReport: "reportActions",
    manageQuotation: "quotationActions",
    managePurchaseOrder: "purchaseOrderActions",
    manageInquiry:"inquiryActions",
    manageHome: null, // home does not use actions
  };

  return map[perm] || null;
};

export const authorize = (perm, action = "read") => {
  return (req, res, next) => {
    const admin = req.admin;

    if (admin.systemrole === "SuperAdmin") return next();

    if (!admin.permissions) {
      return res.status(403).json({
        success: false,
        message: "Permissions not assigned by Admin",
      });
    }

    const permissionFlag = admin.permissions[perm];
    const actionKey = getActionKey(perm);

    if (!permissionFlag) {
      return res.status(403).json({
        success: false,
        message: "Module access denied",
      });
    }

    if (actionKey && !admin.permissions[actionKey]?.[action]) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission to perform the '${action}' action on this module.`,
      });
    }

    next();
  };
};
