import Quotation from '../models/Quotation.js';
import Lead from '../models/Lead.js';

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

    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    const lead = await Lead.findById(leadId).populate('createdBy', 'name email');
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    if (!parsedItems || !Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required for quotation'
      });
    }

    const quotationData = {
      leadId,
      customerDetails: {
        customerName: lead.customerName,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        address: lead.address
      },
      items: parsedItems,
      taxRate,
      validityDays,
      notes,
      termsAndConditions,
      createdBy: req.admin.id
    };

    if (req.file) {
      quotationData.pdfFile = {
        s3Key: req.file.key,
        originalName: req.file.originalname,
        s3Url: req.file.location,
        fileSize: req.file.size,
        uploadedAt: new Date()
      };
    }

    const quotation = await Quotation.create(quotationData);

    await quotation.populate('leadId', 'customerName contactPerson email');
    await quotation.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
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

const uploadQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'PDF file is required'
      });
    }

    quotation.pdfFile = {
      s3Key: req.file.key,
      originalName: req.file.originalname,
      s3Url: req.file.location,
      fileSize: req.file.size,
      uploadedAt: new Date()
    };

    await quotation.save();
    await quotation.populate('leadId', 'customerName contactPerson email');
    await quotation.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'PDF uploaded successfully',
      data: quotation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const downloadQuotationPDF = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    if (!quotation.pdfFile || !quotation.pdfFile.s3Url) {
      return res.status(404).json({
        success: false,
        error: 'PDF not found for this quotation'
      });
    }

    res.redirect(quotation.pdfFile.s3Url);

    // Alternatively, you can stream the file from S3:
    /*
    const s3 = await import('../config/aws.js');
    const fileStream = s3.default.getObject({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: quotation.pdfFile.s3Key
    }).createReadStream();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quotation.pdfFile.originalName}"`);
    fileStream.pipe(res);
    */

  } catch (error) {
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
  uploadQuotationPDF,
  downloadQuotationPDF,
  deleteQuotationPDF,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  getQuotationsByLead
};