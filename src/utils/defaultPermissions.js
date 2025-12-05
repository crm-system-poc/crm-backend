export const defaultPermissions = {
  manageHome: true,

  manageLeads: true,
  leadsActions: { create: true, read: true, update: true, delete: true },

  manageQuotation: true,
  quotationActions: { create: true, read: true, update: true, delete: true },

  managePurchaseOrder: true,
  purchaseOrderActions: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },

  manageReport: true,
  reportActions: { create: true, read: true, update: true, delete: true },

  managePlatformUsers: true,
  platformUserActions: { create: true, read: true, update: true, delete: true },

  manageProducts: true,
  productsActions: { create: true, read: true, update: true, delete: true },

  manageInquiry: true,
  inquiryActions: {
    create: true,
    read: true,
    update: true,
    delete: true,
  }
};
