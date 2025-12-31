import mongoose from 'mongoose';
import Counter from "../utils/Counter.js";

// Accept empty string OR enum for licenseType: use set or validate for ""
const poItemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  licenseType: {
    type: String,
    enum: ['perpetual', 'saas', 'sro', 'mro', 'xaas', 'other'],
    default: 'other',
    set: v => (v === "" ? undefined : v), // treat empty string as undefined (to use default or be omitted)
    validate: {
      validator: function (v) {
        // Accept undefined/null or enum, but reject any non-enum except empty string
        return (
          v === undefined ||
          v === null ||
          v === "" ||
          ['perpetual', 'saas', 'sro', 'mro', 'xaas', 'other'].includes(v)
        );
      },
      message: 'Invalid license type'
    }
  },
  licenseExpiryDate: {
    type: Date,
    validate: {
      validator: function(date) {
        if (this.licenseType && this.licenseType !== 'perpetual') {
          return date && date > new Date();
        }
        return true;
      },
      message: 'License expiry date must be in the future for non-perpetual licenses'
    }
  },
  unitPrice: {
    type: Number,
    min: [0, 'Unit price cannot be negative']
  },
  oemPrice: {
    type: Number,
    min: [0, 'Oem price cannot be negative']
  },
  totalPrice: {
    type: Number,
    min: [0, 'Total price cannot be negative']
  }
});

const poAttachmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['po', 'invoice', 'license_file', 'installation_report', 'license_agreement', 'other'],
    required: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  s3Key: {
    type: String,
    required: true,
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
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
});

const purchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true,
    required: [true, 'PO Number is required (enter as on customer PO)'],
    trim: true,
    uppercase: true
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: [true, 'Lead reference is required']
  },
  quotationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quotation'
  },
  parentPoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PurchaseOrder",
    default: null,
    index: true,
  },
  poType: {
    type: String,
    enum: ["base", "sales", "service"],
    default: "base",
    index: true,
  },
  poDate: {
    type: Date,
    required: [true, 'PO Date is required'],
    default: Date.now,
    validate: {
      validator: function(date) {
        return date <= new Date();
      },
      message: 'PO Date cannot be in the future'
    }
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
  items: {
    type: [poItemSchema],
    required: [true, 'At least one item is required'],
    validate: {
      validator: function(items) {
        return items && items.length > 0;
      },
      message: 'At least one item is required'
    }
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'acknowledged', 'in_progress', 'completed', 'cancelled'],
    default: 'draft'
  },
  paymentTerms: {
    type: String,
    trim: true,
    maxlength: [500, 'Payment terms cannot exceed 500 characters']
  },
  amcPeriod: {
    type: String,
  },
  rewardId: {
    type: String,
    trim: true,
  },
  deliveryTerms: {
    type: String,
    trim: true,
    maxlength: [500, 'Delivery terms cannot exceed 500 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  poPdf: {
    originalName: {
      type: String,
      required: function () {
        return this.poType === "base";
      },
      trim: true
    },
    s3Key: {
      type: String,
      required: function () {
        return this.poType === "base";
      },
      trim: true
    },
    s3Url: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number,
      required: function () {
        return this.poType === "base";
      },
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  attachments: [poAttachmentSchema],
  sentDate: {
    type: Date
  },
  acknowledgedDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: true,
    index: true,
  },
  superAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
    index: true,
  },  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  assignedUsers: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: true
      },
      permissions: {
        read: { type: Boolean, default: true },
        update: { type: Boolean, default: false },
        delete: { type: Boolean, default: false }
      }
    }
  ]
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

// Ensure PO number is unique across all documents
// purchaseOrderSchema.index({ poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ leadId: 1 });
purchaseOrderSchema.index({ quotationId: 1 });
purchaseOrderSchema.index({ status: 1 });
purchaseOrderSchema.index({ poDate: -1 });
purchaseOrderSchema.index({ createdBy: 1 });
purchaseOrderSchema.index({ 'items.licenseExpiryDate': 1 });

purchaseOrderSchema.pre("save", async function (next) {
  if (!this.isNew || this.poNumber) return next();

  try {
    this.poNumber = await this.constructor.getNextPoNumber();
    next();
  } catch (err) {
    next(err);
  }
});

purchaseOrderSchema.pre('validate', function(next) {
  if (this.items && this.items.length > 0) {
    this.items.forEach(item => {
      if (!item.totalPrice && item.unitPrice && item.quantity) {
        item.totalPrice = item.unitPrice * item.quantity;
      }
      if (item.licenseType === "") {
        item.licenseType = undefined;
      }
    });

    if (!this.totalAmount) {
      this.totalAmount = this.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    }
  }
  next();
});

purchaseOrderSchema.virtual('hasExpiredLicenses').get(function() {
  const now = new Date();
  return this.items.some(item => 
    item.licenseExpiryDate && item.licenseExpiryDate < now
  );
});

purchaseOrderSchema.virtual('expiringSoonLicenses').get(function() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return this.items.filter(item => 
    item.licenseExpiryDate && 
    item.licenseExpiryDate > now && 
    item.licenseExpiryDate <= thirtyDaysFromNow
  );
});

purchaseOrderSchema.statics.findWithExpiringLicenses = async function(days = 30) {
  const targetDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  
  return this.find({
    'items.licenseExpiryDate': {
      $lte: targetDate,
      $gte: new Date() 
    },
    status: { $in: ['acknowledged', 'in_progress', 'completed'] }
  }).populate('leadId', 'customerName contactPerson email');
};

purchaseOrderSchema.statics.getNextPoNumber = async function () {
  const year = new Date().getFullYear();
  const counterId = `PO-${year}`;

  const count = await this.countDocuments();

  return `PO${year}${String(count + 1).padStart(5, "0")}`;
};

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);