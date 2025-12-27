import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    contactPerson: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },

    alternateEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },

    phoneNumber: {
      type: String,
      trim: true,
    },

    alternateNumber: {
      type: String,
      trim: true,
    },

    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "India" },
    },

    location: String,

    // Add isActive field
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

 
    superAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      // index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // ✅ SOFT DELETE FLAG (FIX)
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// 🚫 Avoid duplicate accounts per tenant
accountSchema.index(
  { superAdminId: 1, email: 1 },
  { unique: true, sparse: true }
);

export default mongoose.model("Account", accountSchema);
