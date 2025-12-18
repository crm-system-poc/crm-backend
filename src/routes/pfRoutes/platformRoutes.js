import express from "express";
import {
  platformLogin,
  setupPlatformAdmin, 
  platformLogout,
  getPlatformProfile,
  updatePlatformProfile,
  changePlatformPassword,
} from "../../controllers/platfromAdmin/platformAuthController.js";

import {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
} from "../../controllers/platfromAdmin/platformStaffController.js";

import { platformAuthMiddleware, authorizePlatform } from "../../middlewares/pfadminMiddleware/platformAuthMiddleware.js";

const router = express.Router();

// FIRST TIME SETUP
router.post("/setup", setupPlatformAdmin);

// LOGIN / LOGOUT
router.post("/login", platformLogin);
router.post("/logout", platformLogout);

// Only PlatformAdmin can manage staff
router.use(platformAuthMiddleware);

// AUTH REQUIRED
router.get("/profile", getPlatformProfile);
router.put("/profile", updatePlatformProfile);
router.put("/change-password", changePlatformPassword);

router.post("/create-staff", authorizePlatform("managePlatformUsers", "create"), createStaff);
router.get("/staff", authorizePlatform("managePlatformUsers", "read"), getAllStaff);
router.get("/staff/:id", authorizePlatform("managePlatformUsers", "read"), getStaffById);
router.put("/staff/:id", authorizePlatform("managePlatformUsers", "update"), updateStaff);
router.delete("/staff/:id",authorizePlatform("managePlatformUsers", "delete"), deleteStaff);

export default router;
