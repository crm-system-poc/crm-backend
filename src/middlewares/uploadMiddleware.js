import multer from 'multer';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    pdf: ['application/pdf'],
    document: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
  };

  if (allowedMimes.image.includes(file.mimetype) || 
      allowedMimes.pdf.includes(file.mimetype) || 
      allowedMimes.document.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

export const uploadSingle = (fieldName) => upload.single(fieldName);

export const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);

export const uploadFields = (fields) => upload.fields(fields);

export const uploadImage = upload.single('image');
export const uploadPDF = upload.single('pdf');
export const uploadDocument = upload.single('document');
export const uploadMultipleImages = upload.array('images', 10);
export const uploadMultipleFiles = upload.array('files', 5);