import Admin from '../models/Admin.js';


const createUser = async (req, res) => {
    try {
      if (req.admin.role !== "SuperAdmin") {
        return res.status(403).json({ message: "Access denied" });
      }
  
      const { name, email, phone, password, permissions } = req.body;
  
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Name, email & password are required'
        });
      }
  
      // Email must be unique
      const existingEmail = await Admin.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ error: "Email already exists" });
      }
  
      // phone must be unique
      if (phone) {
        const existingphone = await Admin.findOne({ phone });
        if (existingphone) {
          return res.status(400).json({ error: "phone already exists" });
        }
      }
  
      const user = await Admin.create({
        name,
        email,
        phone,
        password,
        role: "User",
        permissions: permissions || {} // if no permissions assigned yet
      });
  
      res.status(201).json({
        success: true,
        message: "User created successfully",
        user
      });
  
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };
  


  const getAllUsers = async (_, res) => {
    const users = await Admin.find({ role: "User" });
    res.json(users);
  };


  const updatePermissions = async (req, res) => {
    try {
      if (req.admin.role !== "SuperAdmin") {
        return res.status(403).json({ message: "Access denied" });
      }
  
      const { permissions } = req.body;
  
      if (!permissions) {
        return res.status(400).json({
          success: false,
          message: "Permissions data is required"
        });
      }
  
      const userId = req.params.id;
  
      const user = await Admin.findByIdAndUpdate(
        userId,
        { permissions },
        { new: true }
      );
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.json({
        success: true,
        message: "Permissions updated successfully",
        user
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
  

  const getUserById = async (req, res) => {
    try {
      if (req.admin.role !== "SuperAdmin") {
        return res.status(403).json({ message: "Access denied" });
      }
  
      const user = await Admin.findOne({
        _id: req.params.id,
        role: "User"
      });
  
      if (!user)
        return res.status(404).json({ message: "User not found" });
  
      res.json({
        success: true,
        user
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };


  const deleteUserById = async (req, res) => {
    try {
      if (req.admin.role !== "SuperAdmin") {
        return res.status(403).json({ message: "Access denied" });
      }
  
      const deletedUser = await Admin.findOneAndDelete({
        _id: req.params.id,
        role: "User"
      });
  
      if (!deletedUser)
        return res.status(404).json({ message: "User not found" });
  
      res.json({
        success: true,
        message: "User deleted successfully"
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };

  export {
    createUser,
    getAllUsers,
    getUserById,
    updatePermissions,
    deleteUserById
  };