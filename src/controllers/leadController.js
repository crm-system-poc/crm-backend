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

const createLead = async (req, res) => {
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
    });

    await lead.populate("createdBy", "name email");

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

const getLeadsByCustomer = async (req, res) => {
  try {
    const { customerIdentifier } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const leads = await Lead.find({
      $or: [
        { customerName: { $regex: customerIdentifier, $options: "i" } },
        { email: { $regex: customerIdentifier, $options: "i" } },
      ],
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Lead.countDocuments({
      $or: [
        { customerName: { $regex: customerIdentifier, $options: "i" } },
        { email: { $regex: customerIdentifier, $options: "i" } },
      ],
    });

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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getAllLeads = async (req, res) => {
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

    const filter = {};

    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { contactPerson: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    if (source) {
      filter.source = source;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const leads = await Lead.find(filter)
      .populate("createdBy", "name email")
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate(
      "createdBy",
      "name email"
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const updateLead = async (req, res) => {
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
    } = req.body;

    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    if (email && email !== lead.email) {
      const emailExists = await Lead.isEmailTaken(email, req.params.id);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          error: "Email already exists",
        });
      }
    }

    if (phoneNumber && phoneNumber !== lead.phoneNumber) {
      const phoneExists = await Lead.isPhoneTaken(phoneNumber, req.params.id);
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          error: "Phone number already exists",
        });
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

    await lead.save();
    await lead.populate("createdBy", "name email");

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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        error: "Lead not found",
      });
    }

    await Lead.findByIdAndDelete(req.params.id);

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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getLeadStats = async (req, res) => {
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

    const byStatus = STATUS_LIST.map((status) =>
      statsMap[status] || { status, count: 0, totalValue: 0 }
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

    const PRIORITY_LIST = ["low", "medium", "high"];
    const priorityAgg = await Lead.aggregate([
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);
    const priorityMap = {};
    priorityAgg.forEach((item) => {
      priorityMap[item._id] = { priority: item._id, count: item.count };
    });
    const byPriority = PRIORITY_LIST.map((priority) =>
      priorityMap[priority] || { priority, count: 0 }
    );

    res.json({
      success: true,
      data: {
        byStatus,
        byPriority,
        totalLeads,
        totalValue,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getLeadStats,
  getLeadsByCustomer,
};
