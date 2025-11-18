import express from 'express';
import {
  setupAdmin,
  loginAdmin,
  getProfile,
  updateProfile,
  changePassword,logoutAdmin,
  createUser,
  getAllUsers
} from '../controllers/adminController.js';
import { authMiddleware , authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/setup', setupAdmin);
router.post('/login', loginAdmin);

router.use(authMiddleware);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logoutAdmin);


router.post(
  "/create-user",
  authMiddleware,
  authorize("manageLeads", "create"), 
  createUser
);

router.get(
  "/users",
  authMiddleware,
  authorize("manageLeads", "read"),
  getAllUsers
);

export default router;