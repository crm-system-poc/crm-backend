import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      default: function() {
        return this._id.toString().toUpperCase();
      },    
      required: true,
      // unique: true,
      // immutable: true,
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },
    productCode: {
      type: String,
      required: [true, "Product code is required"],
      trim: true,
      uppercase: true,
      unique: true,
    },
    category: {
      type: String,
      trim: true,
    },
    oem: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    oemPrice: {
      type: Number,
      min: [0, "OEM price cannot be negative"],
      required: [true, "OEM price is required"],
    },
    sellingPrice: {
      type: Number,
      min: [0, "Selling price cannot be negative"],
      required: [true, "Selling price is required"],
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

productSchema.statics.isCodeTaken = async function (productCode, excludeId) {
  const code = productCode?.toUpperCase();
  const query = { productCode: code };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const product = await this.findOne(query).lean();
  return Boolean(product);
};

productSchema.statics.isProductIdTaken = async function (productId, excludeId) {
  const id = productId?.toUpperCase();
  const query = { productId: id };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const product = await this.findOne(query).lean();
  return Boolean(product);
};

productSchema.index({ productId: 1 });
productSchema.index({ productCode: 1 });
productSchema.index({ productName: 1 });
productSchema.index({ category: 1 });
productSchema.index({ oem: 1 });
productSchema.index({ superAdminId: 1, productId: 1 }, { unique: true });
productSchema.index({ superAdminId: 1, productCode: 1 }, { unique: true });

export default mongoose.model("Product", productSchema);

