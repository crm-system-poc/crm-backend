import multer from 'multer';
import multerS3 from 'multer-s3';
import s3 from '../config/aws.js';
import path from 'path';

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.S3_BUCKET_NAME,
    acl: 'public-read', 
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const filename = `quotations/${uniqueSuffix}-${file.originalname}`;
      cb(null, filename);
    }
  }),
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 
  }
});

export const uploadPDF = upload.single('quotationPdf');

export const uploadMultiplePDFs = upload.array('quotationPdfs', 5);