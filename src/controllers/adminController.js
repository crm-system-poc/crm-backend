import Admin from '../models/Admin.js';
import jwt from 'jsonwebtoken';

const generateToken = (adminId) => {
  return jwt.sign(
    { id: adminId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.TOKEN_EXPIRY || '7d' }
  );
};

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax', 
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
};

const setupAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email and password'
      });
    }

    const admin = await Admin.createAdmin({
      name,
      email,
      password
    });

    const token = generateToken(admin._id);

    res.cookie('adminToken', token, getCookieOptions());

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email
        }
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    const admin = await Admin.findByCredentials(email, password);
    
    const token = generateToken(admin._id);

    res.cookie('adminToken', token, getCookieOptions());

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          lastLogin: admin.lastLogin
        }
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id);
    
    res.json({
      success: true,
      data: admin
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone, profileImage } = req.body;

    const admin = await Admin.findById(req.admin.id);
    
    if (name) admin.name = name;
    if (phone) admin.phone = phone;
    if (profileImage) admin.profileImage = profileImage;
    
    await admin.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: admin
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Please provide current and new password'
      });
    }

    const admin = await Admin.findById(req.admin.id).select('+password');
    
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    admin.password = newPassword;
    await admin.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
};

const logoutAdmin = async (req, res) => {
  try {
    res.clearCookie('adminToken', getCookieOptions());
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export {
  setupAdmin,
  loginAdmin,
  getProfile,
  updateProfile,
  changePassword,
  logoutAdmin
};