import Inquiry from "../models/Inquiry.js";
import Lead from "../models/Lead.js";


export const isSameId = (a, b) => {
    if (!a || !b) return false;
    return a.toString() === b.toString();
  };
  
  export const canAccessInquiry = (inquiry, admin, action) => {
    if (!inquiry || !admin) return false;
  
    if (admin.systemrole === "SuperAdmin") return true;
  
    if (isSameId(inquiry.createdBy, admin.id)) return true;
  
    const assigned = (inquiry.assignedUsers || []).find(
      (u) => isSameId(u.user, admin.id)
    );
  
    if (!assigned || !assigned.permissions) return false;
  
    return assigned.permissions[action] === true;
  };
  

export const createInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.create({
      ...req.body,
      createdBy: req.admin.id,
    });

    res.status(201).json({
      success: true,
      message: "Inquiry created successfully",
      data: inquiry,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getAllInquiries = async (req, res) => {
  try {
    const isSuperAdmin = req.admin.systemrole === "SuperAdmin";

    const filter = isSuperAdmin
      ? {}
      : {
          $or: [
            { createdBy: req.admin.id },
            { "assignedUsers.user": req.admin.id },
          ],
        };

    const inquiries = await Inquiry.find(filter)
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email");

    res.json({ success: true, data: inquiries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getInquiryById = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email");

    if (!inquiry) {
      return res.status(404).json({ success: false, error: "Inquiry not found" });
    }

    if (!canAccessInquiry(inquiry, req.admin, "read")) {
      return res.status(403).json({ success: false, error: "No permission to view" });
    }

    res.json({ success: true, data: inquiry });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({ success: false, error: "Inquiry not found" });
    }

    if (!canAccessInquiry(inquiry, req.admin, "update")) {
      return res.status(403).json({ success: false, error: "No permission to update" });
    }

    Object.assign(inquiry, req.body);

    await inquiry.save();

    res.json({
      success: true,
      message: "Inquiry updated successfully",
      data: inquiry,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteInquiry = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({ success: false, error: "Inquiry not found" });
    }

    if (!canAccessInquiry(inquiry, req.admin, "delete")) {
      return res.status(403).json({ success: false, error: "No permission to delete" });
    }

    await inquiry.deleteOne();

    res.json({
      success: true,
      message: "Inquiry deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


export const convertInquiryToLead = async (req, res) => {
  try {
    const inquiry = await Inquiry.findById(req.params.id);

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: "Inquiry not found"
      });
    }

    if (!canAccessInquiry(inquiry, req.admin, "update")) {
      return res.status(403).json({
        success: false,
        error: "Not allowed to convert this inquiry"
      });
    }

    const leadData = {
      customerName: inquiry.customerName || "Unknown Customer",
      contactPerson: inquiry.customerName || "Unknown",
      email: inquiry.email || "no-email@example.com",
      phoneNumber: inquiry.phoneNumber || "0000000000",
      altPhoneNumber: "",
      altEmail: "",
      location: inquiry.city || "Not Provided",
      source: "inquiry",
      notes: inquiry.message || "",
      status: "new",
      priority: "medium",
      estimatedValue: 0,
      createdBy: req.admin.id,
      address: {
        street: inquiry.city || "Unknown",
        city: inquiry.city || "Unknown",
        state: "Unknown",
        zipCode: "000000",
        country: "India"
      }
    };

    const newLead = await Lead.create(leadData);

    inquiry.status = "qualified";
    inquiry.isConvertedToLead = true;
    await inquiry.save();

    res.json({
      success: true,
      message: "Inquiry converted to Lead successfully",
      data: newLead
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};