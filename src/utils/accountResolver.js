import Account from "../models/Account.js";

export const resolveAccount = async ({
  accountId,
  payload,
  admin,
}) => {
  // 1️⃣ If accountId provided → verify
  if (accountId) {
    const account = await Account.findOne({
      _id: accountId,
      superAdminId: admin.superAdminId || admin.id,
    });

    if (!account) {
      throw new Error("Account not found");
    }

    return account;
  }

  // 2️⃣ Try finding existing account by email (preferred)
  if (payload.email) {
    const existing = await Account.findOne({
      email: payload.email,
      superAdminId: admin.superAdminId || admin.id,
    });

    if (existing) return existing;
  }

  // 3️⃣ Auto-create account
  const account = await Account.create({
    customerName: payload.customerName,
    contactPerson: payload.contactPerson,
    email: payload.email,
    alternateEmail: payload.alternateEmail,
    phoneNumber: payload.phoneNumber,
    alternateNumber: payload.alternateNumber,
    address: payload.address,
    location: payload.location,
    createdBy: admin.id,
    superAdminId: admin.superAdminId || admin.id,
  });

  return account;
};
