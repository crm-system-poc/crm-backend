import OEM from "../models/OEM.js";
import { getSuperAdminId } from "../utils/superAdmin.js";

/**
 * CREATE OEM
 */
export const createOEM = async (req, res) => {
  try {
    const { name, email, contactNumber } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: "OEM name is required" });
    }

    const superAdminId = getSuperAdminId(req);

    const exists = await OEM.findOne({ name, superAdminId });
    if (exists) {
      return res.status(400).json({ success: false, error: "OEM already exists" });
    }

    const oem = await OEM.create({
      name,
      email,
      contactNumber,
      superAdminId,
      createdBy: req.admin.id,
    });

    res.status(201).json({
      success: true,
      message: "OEM created successfully",
      data: oem,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET ALL OEMs
 */
export const getAllOEMs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive = "true",
    } = req.query;

    const pageNum = Math.max(parseInt(page), 1);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      superAdminId: req.admin.superAdminId || req.admin.id,
    };

    if (isActive !== "all") {
      filter.isActive = isActive === "true";
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
      ];
    }

    const [data, total] = await Promise.all([
      OEM.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      OEM.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * GET OEM BY ID
 */
export const getOEMById = async (req, res) => {
  try {
    const superAdminId = getSuperAdminId(req);

    const oem = await OEM.findOne({
      _id: req.params.id,
      superAdminId,
    });

    if (!oem) {
      return res.status(404).json({ success: false, error: "OEM not found" });
    }

    res.json({ success: true, data: oem });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * UPDATE OEM
 */
export const updateOEM = async (req, res) => {
  try {
    const { name, email, contactNumber, isActive } = req.body;
    const superAdminId = getSuperAdminId(req);

    const oem = await OEM.findOne({
      _id: req.params.id,
      superAdminId,
    });

    if (!oem) {
      return res.status(404).json({ success: false, error: "OEM not found" });
    }

    if (name) oem.name = name;
    if (email !== undefined) oem.email = email;
    if (contactNumber !== undefined) oem.contactNumber = contactNumber;
    if (isActive !== undefined) oem.isActive = isActive;

    await oem.save();

    res.json({
      success: true,
      message: "OEM updated successfully",
      data: oem,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * DELETE OEM (Soft delete)
 */
export const deleteOEM = async (req, res) => {
  try {
    const superAdminId = getSuperAdminId(req);

    const oem = await OEM.findOne({
      _id: req.params.id,
      superAdminId,
    });

    if (!oem) {
      return res.status(404).json({ success: false, error: "OEM not found" });
    }

    oem.isActive = false;
    await oem.save();

    res.json({
      success: true,
      message: "OEM deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getOEMDropdown = async (req, res) => {
  try {
    const oems = await OEM.find(
      { isActive: true },
      { name: 1 } // only required fields
    ).sort({ name: 1 });

    res.json({
      success: true,
      data: oems.map((o) => ({
        id: o._id,
        name: o.name,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


  
  
