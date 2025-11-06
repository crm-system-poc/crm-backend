import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: [true, 'Customer name is required'],
    trim: true,
    maxlength: [100, 'Customer name cannot exceed 100 characters']
  },
  contactPerson: {
    type: String,
    required: [true, 'Contact person is required'],
    trim: true,
    maxlength: [100, 'Contact person cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  altEmail: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  altPhoneNumber: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters']
    },
    city: {
      type: String,
      trim: true,
      maxlength: [50, 'City cannot exceed 50 characters']
    },
    state: {
      type: String,
      trim: true,
      maxlength: [50, 'State cannot exceed 50 characters']
    },
    zipCode: {
      type: String,
      trim: true,
      maxlength: [20, 'Zip code cannot exceed 20 characters']
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
      maxlength: [50, 'Country cannot exceed 50 characters']
    }
  },
  location: {
    type: String,
    trim: true,
    maxlength: [100, 'Location cannot exceed 100 characters']
  },
  requirementDetails: {
    type: String,
    trim: true,
    maxlength: [1000, 'Requirement details cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost'],
    default: 'new'
  },
  source: {
    type: String,
    enum: ['website', 'referral', 'social_media', 'cold_call', 'email', 'other'],
    default: 'other'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  estimatedValue: {
    type: Number,
    min: 0
  },
  followUpDate: {
    type: Date
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer', 
    default: null
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

leadSchema.index({ email: 1 });
leadSchema.index({ phoneNumber: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ createdBy: 1 });
leadSchema.index({ followUpDate: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ customerName: 1}); 

leadSchema.statics.isDuplicateLead = async function(customerName, excludeLeadId = null) {
  const lead = await this.findOne({ 
    customerName: { $regex: new RegExp(`^${customerName}$`, 'i') },
    _id: { $ne: excludeLeadId } 
  });
  return !!lead;
};

leadSchema.statics.isEmailTakenForActiveLead = async function(email, excludeLeadId = null) {
  const lead = await this.findOne({ 
    email, 
    status: { $in: ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation'] },
    _id: { $ne: excludeLeadId } 
  });
  return !!lead;
};

export default mongoose.model('Lead', leadSchema);