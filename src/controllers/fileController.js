import {
    uploadToS3,
    getFilesByFolder,
    getPresignedUrl,
    deleteFileFromS3,
    getDownloadUrl
  } from '../utils/s3Utils.js';
  
  // @desc    Upload single file
  // @route   POST /api/files/upload
  // @access  Private
  const uploadFile = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }
  
      const folder = req.body.folder || 'general';
      const uploadResult = await uploadToS3(req.file, folder);
  
      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: uploadResult
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // @desc    Upload multiple files
  // @route   POST /api/files/upload-multiple
  // @access  Private
  const uploadMultipleFiles = async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files provided'
        });
      }
  
      const folder = req.body.folder || 'general';
      const uploadPromises = req.files.map(file => uploadToS3(file, folder));
      const uploadResults = await Promise.all(uploadPromises);
  
      res.status(201).json({
        success: true,
        message: `${req.files.length} files uploaded successfully`,
        data: uploadResults
      });
    } catch (error) {
      console.error('Multiple files upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // @desc    Get files by folder
  // @route   GET /api/files/folder/:folder
  // @access  Private
  const getFiles = async (req, res) => {
    try {
      const { folder } = req.params;
      const files = await getFilesByFolder(folder);
  
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      console.error('Get files error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // @desc    Get presigned URL for file access
  // @route   GET /api/files/presigned-url/:key
  // @access  Private
  const getFilePresignedUrl = async (req, res) => {
    try {
      const { key } = req.params;
      const { expiresIn = 3600 } = req.query;
  
      const presignedUrl = await getPresignedUrl(key, parseInt(expiresIn));
  
      res.json({
        success: true,
        data: {
          presignedUrl,
          expiresIn: `${expiresIn} seconds`
        }
      });
    } catch (error) {
      console.error('Presigned URL error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // @desc    Get download URL for file
  // @route   GET /api/files/download/:key
  // @access  Private
  const downloadFile = async (req, res) => {
    try {
      const { key } = req.params;
      const { filename } = req.query;
  
      const downloadInfo = await getDownloadUrl(key, filename);
  
      res.json({
        success: true,
        data: downloadInfo
      });
    } catch (error) {
      console.error('Download URL error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // @desc    Delete file
  // @route   DELETE /api/files/:key
  // @access  Private
  const deleteFile = async (req, res) => {
    try {
      const { key } = req.params;
  
      const result = await deleteFileFromS3(key);
  
      res.json({
        success: true,
        message: 'File deleted successfully',
        data: result
      });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // @desc    Upload profile image
  // @route   POST /api/files/upload/profile-image
  // @access  Private
  const uploadProfileImage = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image provided'
        });
      }
  
      // Check if file is an image
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          error: 'Only image files are allowed'
        });
      }
  
      const folder = `profile-images/${req.admin.id}`;
      const uploadResult = await uploadToS3(req.file, folder);
  
      res.status(201).json({
        success: true,
        message: 'Profile image uploaded successfully',
        data: uploadResult
      });
    } catch (error) {
      console.error('Profile image upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // @desc    Upload quotation PDF
  // @route   POST /api/files/upload/quotation-pdf
  // @access  Private
  const uploadQuotationPDF = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No PDF provided'
        });
      }
  
      // Check if file is PDF
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({
          success: false,
          error: 'Only PDF files are allowed'
        });
      }
  
      const folder = `quotations/${req.admin.id}`;
      const uploadResult = await uploadToS3(req.file, folder);
  
      res.status(201).json({
        success: true,
        message: 'Quotation PDF uploaded successfully',
        data: uploadResult
      });
    } catch (error) {
      console.error('Quotation PDF upload error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  export {
    uploadFile,
    uploadMultipleFiles,
    getFiles,
    getFilePresignedUrl,
    downloadFile,
    deleteFile,
    uploadProfileImage,
    uploadQuotationPDF
  };