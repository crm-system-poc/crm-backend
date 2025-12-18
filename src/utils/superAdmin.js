export const getSuperAdminId = (req) => {
  return req.admin.superAdminId || req.admin.id;
};
