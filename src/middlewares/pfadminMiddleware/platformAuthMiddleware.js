import jwt from "jsonwebtoken";
import PlatformUser from "../../models/pfModels/PlatformAdmin.js";

const COOKIE_NAME = "platformToken";

/* -----------------------------
   PLATFORM AUTH MIDDLEWARE
-------------------------------- */
export const platformAuthMiddleware = async (req, res, next) => {
  try {
    let token =
      req.cookies?.[COOKIE_NAME] ||
      (req.header("Authorization")
        ? req.header("Authorization").replace("Bearer ", "")
        : null);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await PlatformUser.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({
        success: false,
        error: "Invalid or inactive platform user",
      });
    }

    // 🔐 Ensure permissions object always exists
    user.permissions = user.permissions || {};

    req.platform = user;
    res.setHeader("Cache-Control", "no-store");

    next();
  } catch (err) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token",
    });
  }
};


export const allowPlatformRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.platform || !roles.includes(req.platform.role)) {
      return res.status(403).json({
        success: false,
        error: "Access Denied: Insufficient role permission",
      });
    }
    next();
  };
};

export const requirePlatformAdmin = (req, res, next) => {
  const user = req.platform;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
    });
  }

  if (user.role !== "PlatformAdmin") {
    return res.status(403).json({
      success: false,
      error: "Only PlatformAdmin allowed",
    });
  }

  next();
};


const getPlatformActionKey = (perm) => {
  const map = {
    managePlatformUsers: "platformUserActions",
    manageResellers: "resellerActions",
    managePlatform: null,
  };

  return map[perm] || null;
};

export const authorizePlatform = (perm, action = "read") => {
  return (req, res, next) => {
    const user = req.platform;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // PlatformAdmin bypasses all checks
    if (user.role === "PlatformAdmin") return next();

    if (!user.permissions) {
      return res.status(403).json({
        success: false,
        error: "Permissions not assigned",
      });
    }

    const allowedModule = user.permissions[perm];
    const actionKey = getPlatformActionKey(perm);

    if (!allowedModule) {
      return res.status(403).json({
        success: false,
        error: "Module access denied",
      });
    }

    if (actionKey && !user.permissions[actionKey]?.[action]) {
      return res.status(403).json({
        success: false,
        error: `You do not have '${action}' permission`,
      });
    }

    next();
  };
};

