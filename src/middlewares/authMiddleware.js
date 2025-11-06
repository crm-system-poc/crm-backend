import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export const authMiddleware = async (req, res, next) => {
  try {
    console.log('🔐 Auth Middleware - Checking authentication');
    console.log('📦 Request cookies:', req.cookies);
    console.log('🔑 Authorization header:', req.header('Authorization'));
    
    let token = req.cookies.adminToken;
    
    if (!token && req.header('Authorization')) {
      token = req.header('Authorization').replace('Bearer ', '');
      console.log('🔄 Using token from Authorization header');
    }

    if (!token) {
      console.log('❌ No token found');
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    console.log('✅ Token found:', token.substring(0, 20) + '...');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔓 Decoded token:', decoded);

    const admin = await Admin.findById(decoded.id);
    
    if (!admin) {
      console.log('❌ Admin not found for ID:', decoded.id);
      res.clearCookie('adminToken');
      return res.status(401).json({
        success: false,
        error: 'Token is not valid.'
      });
    }

    console.log('✅ Admin found:', admin.email);
    req.admin = admin;
    next();
  } catch (error) {
    console.log('❌ Auth error:', error.message);
    res.clearCookie('adminToken');
    res.status(401).json({
      success: false,
      error: 'Token is not valid.'
    });
  }
};