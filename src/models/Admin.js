import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  lastLogin: {
    type: Date
  },
  profileImage: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    trim: true,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      return ret;
    }
  }
});

adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

adminSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

adminSchema.statics.createAdmin = async function(adminData) {
  const adminCount = await this.countDocuments();
  
  if (adminCount > 0) {
    throw new Error('Admin already exists. Only one admin account is allowed.');
  }

  return await this.create(adminData);
};

adminSchema.statics.findByCredentials = async function(email, password) {
  const admin = await this.findOne({ email }).select('+password');
  
  if (!admin) {
    throw new Error('Invalid login credentials');
  }

  const isPasswordMatch = await admin.comparePassword(password);
  
  if (!isPasswordMatch) {
    throw new Error('Invalid login credentials');
  }

  await admin.updateOne({ lastLogin: new Date() });

  return admin;
};

export default mongoose.model('Admin', adminSchema);