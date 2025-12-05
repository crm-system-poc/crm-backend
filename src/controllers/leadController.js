import Lead from "../models/Lead.js";

const STATUS_LIST = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
];

// Small helper to safely compare ObjectIds or populated docs
const isSameId = (a, b) => {
  if (!a || !b) return false;
  const aStr = typeof a === "string" ? a : a._id ? a._id.toString() : a.toString();
  const bStr = typeof b === "string" ? b : b._id ? b._id.toString() : b.toString();
  return aStr === bStr;
};

// 🔐 Common per-lead access check
// action: "read" | "update" | "delete"
const canAccessLead = (lead, admin, action) => {
  if (!lead || !admin) return false;

  // 1) SuperAdmin can do anything
  if (admin.systemrole === "SuperAdmin") return true;

  // 2) Creator always has full rights
  const isCreator =
    isSameId(lead.createdBy, admin.id) ||
    isSameId(lead.createdBy?._id, admin.id);

  if (isCreator) return true;

  // 3) Check assignedUsers permissions
  const assignedEntry = (lead.assignedUsers || []).find((a) =>
    isSameId(a.user, admin.id) || isSameId(a.user?._id, admin.id)
  );

  if (!assignedEntry || !assignedEntry.permissions) return false;

  return assignedEntry.permissions[action] === true;
};

// --------------------------- CREATE ---------------------------

export const createLead = async (req, res) => {
  try {
    const {
      customerName,
      contactPerson,
      email,
      phoneNumber,
      altEmail,
      altPhoneNumber,
      address,
      location,
      requirementDetails,
      status,
      source,
      notes,
      priority,
      estimatedValue,
      followUpDate,
      assignedUsers, // optional: SuperAdmin/Manager can assign on create
    } = req.body;

    const emailExists = await Lead.isEmailTakenForActiveLead(email);
    if (emailExists) {
      return res.status(400).json({
        success: false,
        error: "An active lead with this email already exists",
      });
    }

    const lead = await Lead.create({
      customerName,
      contactPerson,
      email,
      phoneNumber,
      altEmail,
      altPhoneNumber,
      address,
      location,
      requirementDetails,
      status,
      source,
      notes,
      priority,
      estimatedValue,
      followUpDate,
      createdBy: req.admin.id,
      // If you use assignedTo array separately, you can derive from assignedUsers if needed
      assignedUsers: assignedUsers || [],
    });

    await lead.populate("createdBy", "name email");
    await lead.populate("assignedUsers.user", "name email");

    res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// --------------------------- LIST (Get All Leads) ---------------------------

export const getAllLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      status,
      priority,
      source,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const baseFilter = {};

    
    if (search) {
      baseFilter.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
     
      ];
    }


    
  
    if (status) baseFilter.status = status;
    if (priority) baseFilter.priority = priority;
    if (source) baseFilter.source = source;

    const filter = { ...baseFilter };

    // Record-based restriction for non-SuperAdmin
    if (req.admin.systemrole !== "SuperAdmin") {
      filter.$and = [
        baseFilter,
        {
          $or: [
            { createdBy: req.admin.id },
            {
              assignedUsers: {
                $elemMatch: {
                  user: req.admin.id,
                  "permissions.read": true,
                },
              },
            },
          ],
        },
      ];
      delete filter.$or; // move search $or inside $and if needed
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const leads = await Lead.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email")
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const total = await Lead.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("getAllLeads error", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// --------------------------- GET BY ID ---------------------------

export const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("createdBy", "name email systemrole")
      .populate("assignedUsers.user", "name email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    if (!canAccessLead(lead, req.admin, "read")) {
      return res.status(403).json({
        success: false,
        error: "No permission to view",
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }
    console.error("getLeadById error", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// --------------------------- UPDATE ---------------------------

export const updateLead = async (req, res) => {
  try {
    const {
      customerName,
      contactPerson,
      email,
      phoneNumber,
      altEmail,
      altPhoneNumber,
      address,
      location,
      status,
      source,
      notes,
      priority,
      estimatedValue,
      followUpDate,
      assignedUsers, // optional update of assignment too
    } = req.body;

    const lead = await Lead.findById(req.params.id)
      .populate("createdBy", "name email systemrole")
      .populate("assignedUsers.user", "name email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    if (!canAccessLead(lead, req.admin, "update")) {
      return res.status(403).json({
        success: false,
        error: "Update permission denied",
      });
    }

    // Email/phone uniqueness checks (optional, keep your own helpers if exist)
    if (email && email !== lead.email) {
      const emailExists = await Lead.isEmailTakenForActiveLead(email, lead._id);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: "An active lead with this email already exists",
        });
      }
    }

    if (phoneNumber && phoneNumber !== lead.phoneNumber) {
      // If you have Lead.isPhoneTaken, use it here; else skip
      if (Lead.isPhoneTaken) {
        const phoneExists = await Lead.isPhoneTaken(phoneNumber, lead._id);
        if (phoneExists) {
          return res.status(400).json({
            success: false,
            error: "Phone number already exists",
          });
        }
      }
    }

    const updateFields = {
      customerName,
      contactPerson,
      email,
      phoneNumber,
      altEmail,
      altPhoneNumber,
      address,
      location,
      status,
      source,
      notes,
      priority,
      estimatedValue,
      followUpDate,
    };

    Object.keys(updateFields).forEach((key) => {
      if (updateFields[key] !== undefined) {
        lead[key] = updateFields[key];
      }
    });

    // Allow SuperAdmin/Manager route (reassign API) to update assignedUsers here if passed
    if (assignedUsers !== undefined) {
      lead.assignedUsers = assignedUsers;
    }

    await lead.save();
    await lead.populate("createdBy", "name email");
    await lead.populate("assignedUsers.user", "name email");

    res.json({
      success: true,
      message: "Lead updated successfully",
      data: lead,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        error: messages.join(", "),
      });
    }
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }
    console.error("updateLead error", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// --------------------------- DELETE ---------------------------

export const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate("createdBy", "name email systemrole")
      .populate("assignedUsers.user", "name email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    if (!canAccessLead(lead, req.admin, "delete")) {
      return res.status(403).json({
        success: false,
        error: "Delete permission denied",
      });
    }

    await lead.deleteOne();

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }
    console.error("deleteLead error", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// --------------------------- STATS ---------------------------

export const getLeadStats = async (req, res) => {
  try {
    const statsAgg = await Lead.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ["$estimatedValue", 0] } },
        },
      },
    ]);

    const statsMap = {};
    statsAgg.forEach((stat) => {
      statsMap[stat._id] = {
        status: stat._id,
        count: stat.count,
        totalValue: stat.totalValue,
      };
    });

    const byStatus = STATUS_LIST.map(
      (status) => statsMap[status] || { status, count: 0, totalValue: 0 }
    );

    const totalLeads = await Lead.countDocuments();

    const totalValueResult = await Lead.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ["$estimatedValue", 0] } },
        },
      },
    ]);
    const totalValue = totalValueResult[0]?.total || 0;

    res.json({
      success: true,
      data: {
        byStatus,
        totalLeads,
        totalValue,
      },
    });
  } catch (error) {
    console.error("getLeadStats error", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// --------------------------- GET BY CUSTOMER ---------------------------

export const getLeadsByCustomer = async (req, res) => {
  try {
    const { customerIdentifier } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const baseFilter = {
      $or: [
        { customerName: { $regex: customerIdentifier, $options: "i" } },
        { email: { $regex: customerIdentifier, $options: "i" } },
      ],
    };

    const filter = { ...baseFilter };

    if (req.admin.systemrole !== "SuperAdmin") {
      filter.$and = [
        baseFilter,
        {
          $or: [
            { createdBy: req.admin.id },
            {
              assignedUsers: {
                $elemMatch: {
                  user: req.admin.id,
                  "permissions.read": true,
                },
              },
            },
          ],
        },
      ];
      delete filter.$or;
    }

    const leads = await Lead.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Lead.countDocuments(filter);

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error("getLeadsByCustomer error", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
