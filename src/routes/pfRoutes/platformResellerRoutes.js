import express from "express";
import {
  createResellerSuperAdmin,
  getAllResellerSuperAdmins,
  getResellerSuperAdminById,
  updateResellerSuperAdmin,
  deleteResellerSuperAdmin,
} from "../../controllers/platfromAdmin/platformAdminResellerController.js";

import {
  platformAuthMiddleware,
  authorizePlatform,
} from "../../middlewares/pfadminMiddleware/platformAuthMiddleware.js";

const router = express.Router();

/* ------------------------------------
   All routes require platform auth
------------------------------------- */
router.use(platformAuthMiddleware);

/* ------------------------------------
   Reseller (SuperAdmin) CRUD
------------------------------------- */

// Create Reseller (SuperAdmin)
router.post(
  "/",
  authorizePlatform("manageResellers", "create"),
  createResellerSuperAdmin
);

// Get all resellers
router.get(
  "/",
  authorizePlatform("manageResellers", "read"),
  getAllResellerSuperAdmins
);

// Get reseller by ID
router.get(
  "/:id",
  authorizePlatform("manageResellers", "read"),
  getResellerSuperAdminById
);

// Update reseller
router.put(
  "/:id",
  authorizePlatform("manageResellers", "update"),
  updateResellerSuperAdmin
);

// Delete reseller
router.delete(
  "/:id",
  authorizePlatform("manageResellers", "delete"),
  deleteResellerSuperAdmin
);

export default router;
