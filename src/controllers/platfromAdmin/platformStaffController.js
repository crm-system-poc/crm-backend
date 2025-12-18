import PlatformUser from "../../models/pfModels/PlatformAdmin.js";

// Create Staff (Admin Only)
export const createStaff = async (req, res) => {
  try {
    // if (req.platform.role !== "PlatformAdmin") {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Only PlatformAdmin can create staff",
    //   });
    // }

    const { name, email, password, phone, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "name, email, password required",
      });
    }

    const exists = await PlatformUser.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        error: "Email already exists",
      });
    }

    const existsPhone = await PlatformUser.findOne({ phone });
    if (existsPhone) {
      return res.status(400).json({
        success: false,
        error: "Phone already exists",
      });
    }


    const staff = await PlatformUser.create({
      name,
      email,
      password,
      phone,
      role: "PlatformStaff",
      createdBy: req.platform._id,
      permissions,
    });

    res.status(201).json({
      success: true,
      message: "Platform staff created",
      data: staff,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};



// Get All Staff
export const getAllStaff = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    let query = {
      role: "PlatformStaff",
    };

    if (req.platform.role === "PlatformAdmin") {
      // Admin sees all staff except himself
      query._id = { $ne: req.platform._id };
    } else {
      // Staff sees only staff created by him
      query.createdBy = req.platform._id;
    }

    const users = await PlatformUser.find(query)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PlatformUser.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};




// Get Single Staff
export const getStaffById = async (req, res) => {
  try {
    const user = await PlatformUser.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Admin can view anyone
    if (req.platform.role === "PlatformAdmin") {
      return res.json({ success: true, data: user });
    }

    // Staff can view only himself
    if (user._id.toString() !== req.platform._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};


// Update Staff
export const updateStaff = async (req, res) => {
  try {
    const user = await PlatformUser.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Permission check
    if (
      req.platform.role !== "PlatformAdmin" &&
      user._id.toString() !== req.platform._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    const { name, email, phone, isActive, permissions } = req.body;

    if (email && email !== user.email) {
      const ex = await PlatformUser.findOne({ email });
      if (ex) {
        return res.status(400).json({
          success: false,
          error: "Email already in use",
        });
      }
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;

    // Only admin can manage permissions & status
    if (req.platform.role === "PlatformAdmin") {
      if (typeof isActive !== "undefined") user.isActive = isActive;
      if (permissions) user.permissions = permissions;
    }

    await user.save();

    res.json({
      success: true,
      message: "User updated",
      data: user,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};



// Delete Staff (Soft Delete)
export const deleteStaff = async (req, res) => {
  try {
    

    const user = await PlatformUser.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: "User deleted",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

