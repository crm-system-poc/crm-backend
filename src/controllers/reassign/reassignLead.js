import Lead from "../../models/Lead.js";
import Admin from "../../models/Admin.js";

export const reassignLead = async (req, res) => {
    try {
      if (req.admin.systemrole !== "SuperAdmin") {
        return res.status(403).json({ success: false, error: "Only SuperAdmin can assign users" });
      }
  
      const { assignedUsers } = req.body;
  
      const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        { assignedUsers },
        { new: true }
      ).populate("assignedUsers.user", "name email");
  
      res.json({
        success: true,
        message: "Users assigned successfully",
        data: lead
      });
  
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
  

export default reassignLead;
