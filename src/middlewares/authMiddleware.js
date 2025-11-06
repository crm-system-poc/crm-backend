import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

export const authMiddleware = async (req, res, next) => {
  try {
    let token = req.cookies.adminToken;
    if (!token && req.header('Authorization')) {
      token = req.header('Authorization').replace('Bearer ', '');
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id);

    if (!admin) {

      res.clearCookie('adminToken');
      return res.status(401).json({
        success: false,
        error: 'Token is not valid.'
      });
    }

    req.admin = admin;
    next();
  } catch (error) {

    res.clearCookie('adminToken');
    res.status(401).json({
      success: false,
      error: 'Token is not valid.'
    });
  }
};