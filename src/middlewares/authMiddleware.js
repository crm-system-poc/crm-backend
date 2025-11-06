import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export const authMiddleware = async (req, res, next) => {
  try {
    // console.log('=== AUTH MIDDLEWARE DEBUG ===');
    // console.log('📨 Request URL:', req.url);
    // console.log('🔍 Request Method:', req.method);
    // console.log('🍪 All Cookies:', req.cookies);
    // console.log('🔑 adminToken Cookie:', req.cookies?.adminToken);
    // console.log('📋 Authorization Header:', req.header('Authorization'));
    // console.log('🌐 Origin Header:', req.header('Origin'));
    // console.log('=============================');

    let token = req.cookies.adminToken;
    
    if (!token && req.header('Authorization')) {
      token = req.header('Authorization').replace('Bearer ', '');
      console.log('🔄 Using token from Authorization header');
    }

    if (!token) {
      console.log('❌ No token found in cookies or headers');
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    console.log('✅ Token found, verifying...');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔓 Decoded token user ID:', decoded.id);

    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      console.log('❌ Admin not found in database');
      res.clearCookie('adminToken');
      return res.status(401).json({
        success: false,
        error: 'Token is not valid.'
      });
    }

    console.log('✅ Authentication successful for:', admin.email);
    req.admin = admin;
    next();
  } catch (error) {
    console.log('❌ JWT Verification Error:', error.message);
    res.clearCookie('adminToken');
    res.status(401).json({
      success: false,
      error: 'Token is not valid.'
    });
  }
};