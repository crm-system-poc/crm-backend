export const getSuperAdminId = (req) => {
  if (!req || !req.admin) {
    throw new Error("Admin context not found on request");
  }

  return req.admin.superAdminId || req.admin.id || req.admin._id;
};
