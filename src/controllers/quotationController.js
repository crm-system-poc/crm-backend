import Quotation from '../models/Quotation.js';
import Lead from '../models/Lead.js';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

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

    const lead = await Lead.findById(leadId).populate('createdBy', 'name email');
    if (!lead) {
      return res.status(404).json({
        success: false,
        error: 'Lead not found'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one item is required for quotation'
      });
    }

    const quotation = await Quotation.create({
      leadId,
      customerDetails: {
        customerName: lead.customerName,
        contactPerson: lead.contactPerson,
        email: lead.email,
        phoneNumber: lead.phoneNumber,
        address: lead.address
      },
      items,
      taxRate,
      validityDays,
      notes,
      termsAndConditions,
      createdBy: req.admin.id
    });

    await quotation.populate('leadId', 'customerName contactPerson email phoneNumber');
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const generateQuotationPDF = async (req, res) => {
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

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quotation-${quotation.quoteId}.pdf`);

    doc.pipe(res);

    doc.fontSize(20).font('Helvetica-Bold').text('QUOTATION', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).font('Helvetica');
    doc.text(`Quote ID: ${quotation.quoteId}`);
    doc.text(`Date: ${quotation.dateOfQuote.toLocaleDateString()}`);
    doc.text(`Valid Until: ${quotation.validUntil.toLocaleDateString()}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Bill To:');
    doc.font('Helvetica');
    doc.text(quotation.customerDetails.customerName);
    doc.text(quotation.customerDetails.contactPerson);
    doc.text(quotation.customerDetails.email);
    doc.text(quotation.customerDetails.phoneNumber);
    doc.text(quotation.customerDetails.address.street);
    doc.text(`${quotation.customerDetails.address.city}, ${quotation.customerDetails.address.state} - ${quotation.customerDetails.address.zipCode}`);
    doc.moveDown();

    const tableTop = doc.y;
    const itemX = 50;
    const descX = 150;
    const qtyX = 350;
    const priceX = 400;
    const totalX = 470;

    doc.font('Helvetica-Bold');
    doc.text('Item', itemX, tableTop);
    doc.text('Description', descX, tableTop);
    doc.text('Qty', qtyX, tableTop);
    doc.text('Price', priceX, tableTop);
    doc.text('Total', totalX, tableTop);
    
    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
    
    let y = tableTop + 25;
    doc.font('Helvetica');
    
    quotation.items.forEach((item, index) => {
      doc.text(item.productId, itemX, y);
      doc.text(item.description, descX, y, { width: 180, align: 'left' });
      doc.text(item.quantity.toString(), qtyX, y);
      doc.text(`₹${item.unitPrice.toLocaleString()}`, priceX, y);
      doc.text(`₹${item.total.toLocaleString()}`, totalX, y);
      y += 20;
    });

    y += 10;
    doc.moveTo(400, y).lineTo(550, y).stroke();
    y += 10;
    
    doc.text('Subtotal:', 400, y);
    doc.text(`₹${quotation.totalQuoteValue.toLocaleString()}`, totalX, y);
    y += 20;
    
    doc.text(`Tax (${quotation.taxRate}%):`, 400, y);
    doc.text(`₹${quotation.taxAmount.toLocaleString()}`, totalX, y);
    y += 20;
    
    doc.font('Helvetica-Bold');
    doc.text('Grand Total:', 400, y);
    doc.text(`₹${quotation.grandTotal.toLocaleString()}`, totalX, y);

    y += 40;
    if (quotation.notes) {
      doc.font('Helvetica-Bold').text('Notes:', 50, y);
      doc.font('Helvetica').text(quotation.notes, 50, y + 15, { width: 500 });
      y += 50;
    }

    doc.font('Helvetica-Bold').text('Terms & Conditions:', 50, y);
    doc.font('Helvetica').text(quotation.termsAndConditions, 50, y + 15, { width: 500 });

    doc.end();

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
    const { status, sentTo } = req.body;

    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    if (status === 'sent' && sentTo) {
      quotation.status = status;
      quotation.sentTo = sentTo;
      quotation.sentDate = new Date();
    } else if (status) {
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
  generateQuotationPDF,
  getAllQuotations,
  getQuotationById,
  updateQuotationStatus,
  getQuotationsByLead
};