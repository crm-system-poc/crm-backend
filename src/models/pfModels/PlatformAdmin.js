import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* ---------------- Action Schema ---------------- */
const actionSchema = new mongoose.Schema(
  {
    create: { type: Boolean, default: false },
    read: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
  },
  { _id: false }
);

/* ---------------- Platform Permission Schema ---------------- */
const platformPermissionSchema = new mongoose.Schema(
  {
    managePlatformHome: { type: Boolean, default: true },

    managePlatformUsers: { type: Boolean, default: false },
    platformUserActions: actionSchema,

    manageResellers: { type: Boolean, default: false },
    resellerActions: actionSchema,

    managePlatformSettings: { type: Boolean, default: false },
    platformSettingsActions: actionSchema,
  },
  { _id: false }
);

/* ---------------- Platform User Schema ---------------- */
const platformUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    profileImage: { type: String, default: null },
    phone: { type: String, trim: true, default: null },

    role: {
      type: String,
      enum: ["PlatformAdmin", "PlatformStaff"],
      required: true,
    },

    isActive: { type: Boolean, default: true },

    permissions: platformPermissionSchema,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PlatformUser",
      default: null,
    }
    
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

/* ---------------- Password Hash ---------------- */
platformUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

platformUserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

/* ---------------- Default Permissions ---------------- */
platformUserSchema.pre("save", function (next) {
  if (!this.permissions) {
    if (this.role === "PlatformAdmin") {
      this.permissions = {
        managePlatformHome: true,

        managePlatformUsers: true,
        platformUserActions: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },

        manageResellers: true,
        resellerActions: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },

        managePlatformSettings: true,
        platformSettingsActions: {
          create: true,
          read: true,
          update: true,
          delete: true,
        },
      };
    } else {
      // PlatformStaff (restricted)
      this.permissions = {
        managePlatformHome: true,

        managePlatformUsers: false,
        platformUserActions: {
          create: false,
          read: false,
          update: false,
          delete: false,
        },

        manageResellers: false,
        resellerActions: {
          create: false,
          read: true,
          update: false,
          delete: false,
        },

        managePlatformSettings: false,
        platformSettingsActions: {
          create: false,
          read: false,
          update: false,
          delete: false,
        },
      };
    }
  }
  next();
});

export default mongoose.model("PlatformAdmin", platformUserSchema);
