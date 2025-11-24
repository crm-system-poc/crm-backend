import express from 'express';
import {
  setupAdmin,
  loginAdmin,
  getProfile,
  updateProfile,
  changePassword,logoutAdmin,
  
} from '../controllers/adminController.js';
import { authMiddleware , authorize } from '../middlewares/authMiddleware.js';

import {  createUser,
  getAllUsers,
  getUserById,
  updatePermissions,
  deleteUserById   } from "../controllers/userController.js"

const router = express.Router();

router.post('/setup', setupAdmin);
router.post('/login', loginAdmin);

router.use(authMiddleware);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logoutAdmin);

// Get All Users
router.get(
  "/users",
  authorize("managePlatformUsers", "read"),
  getAllUsers
);

// Create user
router.post(
  "/create-user",
  authorize("managePlatformUsers", "create"),
  createUser
);

// Get user by ID
router.get(
  "/users/:id",
  authorize("managePlatformUsers", "read"),
  getUserById
);

// Update user permissions
router.put(
  "/users/:id/permissions",
  authorize("managePlatformUsers", "update"),
  updatePermissions
);

// Delete user by ID
router.delete(
  "/users/:id",
  authorize("managePlatformUsers", "delete"),
  deleteUserById
);

export default router;