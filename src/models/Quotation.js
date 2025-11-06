import mongoose from 'mongoose';

const quotationItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: [true, 'Product ID is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  total: {
    type: Number,
    required: true
  }
});

const quotationSchema = new mongoose.Schema({
  quoteId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    uppercase: true
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: [true, 'Lead reference is required']
  },
  dateOfQuote: {
    type: Date,
    required: [true, 'Date of quote is required'],
    default: Date.now
  },
  customerDetails: {
    customerName: {
      type: String,
      required: true,
      trim: true
    },
    contactPerson: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: Object,
      required: true
    }
  },
  items: [quotationItemSchema],
  totalQuoteValue: {
    type: Number,
    required: [true, 'Total quote value is required'],
    min: [0, 'Total quote value cannot be negative']
  },
  taxRate: {
    type: Number,
    default: 18,
    min: 0,
    max: 100
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  validityDays: {
    type: Number,
    default: 30,
    min: 1
  },
  validUntil: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
    default: 'draft'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  termsAndConditions: {
    type: String,
    trim: true,
    default: 'Prices are valid for 30 days. Payment terms: 50% advance, 50% on delivery.'
  },

  pdfFile: {
    s3Key: {
      type: String,
      trim: true
    },
    originalName: {
      type: String,
      trim: true
    },
    s3Url: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

quotationSchema.pre('save', async function(next) {
  if (!this.quoteId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Quotation').countDocuments();
    this.quoteId = `QT${year}${String(count + 1).padStart(4, '0')}`;
  }

  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      item.total = item.unitPrice * item.quantity;
    });
    
    this.totalQuoteValue = this.items.reduce((sum, item) => sum + item.total, 0);
    this.taxAmount = (this.totalQuoteValue * this.taxRate) / 100;
    this.grandTotal = this.totalQuoteValue + this.taxAmount;
  }

  if (!this.validUntil) {
    this.validUntil = new Date(Date.now() + this.validityDays * 24 * 60 * 60 * 1000);
  }

  next();
});

// quotationSchema.index({ quoteId: 1 });
quotationSchema.index({ leadId: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ dateOfQuote: -1 });
quotationSchema.index({ validUntil: 1 });
quotationSchema.index({ createdBy: 1 });

export default mongoose.model('Quotation', quotationSchema);