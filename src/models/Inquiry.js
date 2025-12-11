import mongoose from "mongoose";

const inquirySchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
      required: true,
    },

    city: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, "Message cannot exceed 1000 characters"],
    },

    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "closed"],
      default: "new",
    },

    isConvertedToLead: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      immutable: true, // 👈 prevents override in update()
    },

    assignedUsers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admin",
          required: true,
        },
        permissions: {
          read: { type: Boolean, default: true },
          update: { type: Boolean, default: false },
          delete: { type: Boolean, default: false },
        },
      },
    ],

    isDeleted: { type: Boolean, default: false }, // soft delete support
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Performance indexes
inquirySchema.index({ createdBy: 1 });
inquirySchema.index({ "assignedUsers.user": 1 });
inquirySchema.index({ status: 1 });
inquirySchema.index({ phoneNumber: 1 });
inquirySchema.index({ isDeleted: 1 });

export default mongoose.model("Inquiry", inquirySchema);
