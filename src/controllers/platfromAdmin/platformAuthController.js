import PlatformUser from "../../models/pfModels/PlatformAdmin.js";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "platformToken";
const TOKEN_EXPIRES = "24h"; // adjust as needed

// Helper to sign token
const signToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES }
  );
};

const fullPlatformPermissions = {
  managePlatform: true,

  manageResellers: true,
  resellerActions: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },

  managePlatformUsers: true,
  platformUserActions: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
};


export const setupPlatformAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "name, email and password are required",
      });
    }

    const exists = await PlatformUser.findOne({ role: "PlatformAdmin" });
    if (exists) {
      return res.status(400).json({
        success: false,
        error: "Platform Admin already created",
      });
    }

    const admin = await PlatformUser.create({
      name,
      email,
      password,
      role: "PlatformAdmin",
      permissions: fullPlatformPermissions
    });

    res.json({
      success: true,
      message: "Platform Admin setup completed",
      data: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


export const platformLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await PlatformUser.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ success: false, error: "Invalid login" });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(400).json({ success: false, error: "Invalid login" });
    }

    const token = signToken(user);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions, // ✅ REQUIRED
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// 3. Get profile (requires platformAuth)
export const getPlatformProfile = async (req, res) => {
  try {
    const user = req.platform;
    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 4. Update profile
export const updatePlatformProfile = async (req, res) => {
  try {
    const { name, email, phone, profileImage } = req.body;
    const user = await PlatformUser.findById(req.platform.id);

    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });
    if (email && email !== user.email) {
      const exists = await PlatformUser.findOne({ email });
      if (exists)
        return res
          .status(400)
          .json({ success: false, error: "Email already in use" });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (profileImage) user.profileImage = profileImage;

    await user.save();
    res.json({ success: true, message: "Profile updated", data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 5. Change password
export const changePlatformPassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
      return res
        .status(400)
        .json({
          success: false,
          error: "oldPassword and newPassword required",
        });

    const user = await PlatformUser.findById(req.platform.id).select(
      "+password"
    );
    if (!user)
      return res.status(404).json({ success: false, error: "User not found" });

    const match = await user.comparePassword(oldPassword);
    if (!match)
      return res
        .status(400)
        .json({ success: false, error: "Old password incorrect" });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// 6. Logout
export const platformLogout = async (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true, message: "Platform user logged out" });
};
