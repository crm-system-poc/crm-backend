import { body, validationResult } from 'express-validator';

export const sanitizeInput = [
  body('*').trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

export const validateUser = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().escape().isLength({ min: 2 }),
  body('age').optional().isInt({ min: 0, max: 150 })
];