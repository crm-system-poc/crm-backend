import Quotation from '../models/Quotation.js';
import Lead from '../models/Lead.js';
import { uploadToS3 } from '../utils/s3Utils.js';

const createQuotation = async (req, res) => {
  try {
    const {
      leadId,
      items,
      taxRate = 18,
      validityDays = 30,
      notes,
      termsAndConditions
    } = req.body;

    console.log('📝 Creating quotation with data:', {
      leadId,
      itemsCount: items ? (typeof items === 'string' ? JSON.parse(items).length : items.length) : 0,
      taxRate,
      validityDays
    });

    // Parse items if it's a string (from form-data)
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    // Validate lead exists
    const lead = await Lead.findById(leadId).populate('createdBy', 'name email');
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    // Check if items are provided
    if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required for quotation'
      });
    }

    // Prepare quotation data with calculated fields
    const quotationData = {
      leadId,
      customerDetails: {
        customerName: lead.customerName,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        address: lead.address
      },
      items: parsedItems.map(item => ({
        ...item,
        total: item.unitPrice * item.quantity // Calculate item total upfront
      })),
      taxRate: Number(taxRate),
      validityDays: Number(validityDays),
      notes,
      termsAndConditions,
      createdBy: req.admin.id,
      // Set required fields that will be validated
      totalQuoteValue: parsedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0),
      taxAmount: (parsedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) * taxRate) / 100,
      grandTotal: parsedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0) * (1 + taxRate / 100),
      validUntil: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
    };

    console.log('🧮 Pre-calculated values:', {
      totalQuoteValue: quotationData.totalQuoteValue,
      taxAmount: quotationData.taxAmount,
      grandTotal: quotationData.grandTotal,
      validUntil: quotationData.validUntil
    });

    // Add PDF file info if uploaded
    if (req.file) {
      console.log('📁 File received:', req.file.originalname);
      
      try {
        const folder = `quotations/${req.admin.id}`;
        const s3UploadResult = await uploadToS3(req.file, folder);
        
        quotationData.pdfFile = {
          s3Key: s3UploadResult.key,
          originalName: s3UploadResult.originalName,
          s3Url: s3UploadResult.url,
          fileSize: s3UploadResult.fileSize,
          uploadedAt: new Date()
        };
        
        console.log('✅ File uploaded to S3:', s3UploadResult.key);
      } catch (uploadError) {
        console.error('❌ S3 upload failed:', uploadError);
        return res.status(500).json({
          success: false,
          error: 'Failed to upload PDF to cloud storage: ' + uploadError.message
        });
      }
    }

    // Generate quote ID before creating
    const quoteId = await Quotation.getNextQuoteId();
    quotationData.quoteId = quoteId;
    console.log('🎫 Generated quoteId:', quoteId);

    // Create quotation
    console.log('💾 Saving quotation to database...');
    const quotation = await Quotation.create(quotationData);

    await quotation.populate('leadId', 'customerName contactPerson email');
    await quotation.populate('createdBy', 'name email');

    console.log('✅ Quotation created successfully:', quotation.quoteId);

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: quotation
    });
  } catch (error) {
    console.error('❌ Quotation creation error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      console.error('📋 Validation errors:', messages);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }
    
    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid items format. Please provide valid JSON array.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting quotation:', id);

    // Find the quotation first
    const quotation = await Quotation.findById(id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    // Check if user has permission to delete (optional security check)
    // You can add additional checks here, e.g., only allow deletion by creator or admin
    if (quotation.createdBy.toString() !== req.admin.id) {
      console.log('⚠️ Permission denied: User', req.admin.id, 'tried to delete quotation by', quotation.createdBy);
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this quotation'
      });
    }

    // Delete associated PDF from S3 if exists
    if (quotation.pdfFile && quotation.pdfFile.s3Key) {
      try {
        console.log('📁 Deleting PDF from S3:', quotation.pdfFile.s3Key);
        await deleteFileFromS3(quotation.pdfFile.s3Key);
        console.log('✅ PDF deleted from S3');
      } catch (s3Error) {
        console.error('⚠️ Failed to delete PDF from S3, continuing with database deletion:', s3Error.message);
        // Continue with deletion even if S3 delete fails
      }
    }

    // Delete the quotation from database
    await Quotation.findByIdAndDelete(id);

    console.log('✅ Quotation deleted successfully:', quotation.quoteId);

    res.json({
      success: true,
      message: 'Quotation deleted successfully',
      data: {
        id: quotation._id,
        quoteId: quotation.quoteId,
        customerName: quotation.customerDetails.customerName
      }
    });

  } catch (error) {
    console.error('❌ Quotation deletion error:', error);

    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const deleteQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    if (!quotation.pdfFile) {
      return res.status(404).json({
        success: false,
        error: 'PDF not found for this quotation'
      });
    }

    const s3 = await import('../config/aws.js');
    await s3.default.deleteObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: quotation.pdfFile.s3Key
    }).promise();

    quotation.pdfFile = undefined;
    await quotation.save();

    res.json({
      success: true,
      message: 'PDF deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getAllQuotations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      leadId,
      startDate,
      endDate
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (leadId) filter.leadId = leadId;
    
    if (startDate || endDate) {
      filter.dateOfQuote = {};
      if (startDate) filter.dateOfQuote.$gte = new Date(startDate);
      if (endDate) filter.dateOfQuote.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const quotations = await Quotation.find(filter)
      .populate('leadId', 'customerName contactPerson email')
      .populate('createdBy', 'name email')
      .sort({ dateOfQuote: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Quotation.countDocuments(filter);

    res.json({
      success: true,
      data: quotations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getQuotationById = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('leadId')
      .populate('createdBy', 'name email');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    res.json({
      success: true,
      data: quotation
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const updateQuotationStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

     if (status) {
      quotation.status = status;
    }

    await quotation.save();
    await quotation.populate('leadId', 'customerName contactPerson email');
    await quotation.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Quotation status updated successfully',
      data: quotation
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const getQuotationsByLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const quotations = await Quotation.find({ leadId })
      .populate('createdBy', 'name email')
      .sort({ dateOfQuote: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Quotation.countDocuments({ leadId });

    res.json({
      success: true,
      data: quotations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export {
  createQuotation,
  deleteQuotation,
  deleteQuotationPDF,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  getQuotationsByLead
};