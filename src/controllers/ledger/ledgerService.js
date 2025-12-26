import Ledger from "../models/Ledger.js";

export const createLedgerFromPO = async ({
  superAdminId,
  accountId,
  quotationId,
  purchaseOrder,
  createdBy,
}) => {
  const ledgerItems = purchaseOrder.items.map((item) => ({
    productId: item.productId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.unitPrice * item.quantity,
  }));

  const totalAmount = ledgerItems.reduce(
    (sum, item) => sum + item.totalPrice,
    0
  );

  return await Ledger.create({
    superAdminId,
    accountId,
    quotationId,
    purchaseOrderId: purchaseOrder._id,
    ledgerItems,
    totalAmount,
    createdBy,
  });
};
