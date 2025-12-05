import PurchaseOrder from "../../models/PurchaseOrder.js";
import Admin from "../../models/Admin.js";

export const reassignPurchaseOrder = async (req, res) => {
  try {
    // Only SuperAdmin can reassign
    if (req.admin.systemrole !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        error: "Only SuperAdmin can assign users"
      });
    }

    const { assignedUsers } = req.body;

    if (!assignedUsers || !Array.isArray(assignedUsers)) {
      return res.status(400).json({
        success: false,
        error: "assignedUsers must be an array"
      });
    }

    // Validate users exist + ensure permission structure
    const validAssignedUsers = [];

    for (const entry of assignedUsers) {
      if (!entry.user) continue;

      const userExists = await Admin.findById(entry.user);
      if (!userExists) continue;

      validAssignedUsers.push({
        user: entry.user,
        permissions: {
          read: entry.permissions?.read ?? true,
          update: entry.permissions?.update ?? false,
          delete: entry.permissions?.delete ?? false,
        },
      });
    }

    const updatedPO = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { assignedUsers: validAssignedUsers },
      { new: true }
    ).populate("assignedUsers.user", "name email");

    if (!updatedPO) {
      return res.status(404).json({
        success: false,
        error: "Purchase Order not found"
      });
    }

    res.json({
      success: true,
      message: "Users assigned successfully",
      data: updatedPO
    });
  } catch (error) {
    console.error("❌ Reassign Purchase Order Failed:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

export default reassignPurchaseOrder;
