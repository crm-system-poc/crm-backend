import express from 'express';
import {
  setupAdmin,
  loginAdmin,
  getProfile,
  updateProfile,
  changePassword,logoutAdmin
} from '../controllers/adminController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/setup', setupAdmin);
router.post('/login', loginAdmin);

router.use(authMiddleware);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.post('/logout', logoutAdmin);

export default router;