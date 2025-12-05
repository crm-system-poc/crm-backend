import Quotation from "../../models/Quotation.js";
import Admin from "../../models/Admin.js";

export const reassignQuotation = async (req, res) => {
  try {
    if (req.admin.systemrole !== "SuperAdmin") {
      return res.status(403).json({ success: false, error: "Only SuperAdmin can reassign quotations" });
    }

    const { assignedUsers } = req.body; // [{ user, permissions: {read,update,delete}}]

    if (!Array.isArray(assignedUsers)) {
      return res.status(400).json({
        success: false,
        error: "assignedUsers must be an array"
      });
    }

    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: "Quotation not found"
      });
    }

    // Validate each user record
    for (let entry of assignedUsers) {
      if (!entry.user) {
        return res.status(400).json({
          success: false,
          error: "Each assigned user must have a user field"
        });
      }

      const userExists = await Admin.findById(entry.user);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          error: `User not found: ${entry.user}`
        });
      }

      if (!entry.permissions) {
        entry.permissions = { read: true, update: false, delete: false };
      }
    }

    quotation.assignedUsers = assignedUsers;
    await quotation.save();
    await quotation.populate("assignedUsers.user", "name email");

    res.json({
      success: true,
      message: "Quotation users reassigned successfully",
      data: quotation
    });

  } catch (error) {
    console.error("❌ Reassign quotation error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export default reassignQuotation;
