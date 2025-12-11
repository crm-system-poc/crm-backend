import Inquiry from "../../models/Inquiry.js";
import Admin from "../../models/Admin.js";

/**
 * Reassign Inquiry to users with permissions
 * Only SuperAdmin can do this
 */
export const reassignInquiry = async (req, res) => {
  try {
    // 🔒 Only SuperAdmin
    if (req.admin.systemrole !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Only SuperAdmin can assign users to inquiry",
      });
    }

    const { assignedUsers } = req.body;

    if (!Array.isArray(assignedUsers)) {
      return res.status(400).json({
        success: false,
        error: "assignedUsers must be an array",
      });
    }

    // ✅ Validate users exist
    const userIds = assignedUsers.map((u) => u.user);
    const usersCount = await Admin.countDocuments({ _id: { $in: userIds } });

    if (usersCount !== userIds.length) {
      return res.status(400).json({
        success: false,
        error: "One or more assigned users are invalid",
      });
    }

    const inquiry = await Inquiry.findByIdAndUpdate(
      req.params.id,
      { assignedUsers },
      { new: true }
    )
      .populate("createdBy", "name email")
      .populate("assignedUsers.user", "name email");

    if (!inquiry) {
      return res.status(404).json({
        success: false,
        error: "Inquiry not found",
      });
    }

    res.json({
      success: true,
      message: "Inquiry reassigned successfully",
      data: inquiry,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export default reassignInquiry;
