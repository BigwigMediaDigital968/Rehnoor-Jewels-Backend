// COD orders are confirmed immediately — no gateway needed
function buildCodPaymentRecord() {
  return {
    method: "cod",
    status: "pending", // becomes "paid" on delivery
    amountPaid: 0,
    currency: "INR",
  };
}

// The courier collects cash at the door, so a delivered COD order is paid.
// Mutates the order; the caller saves it. Returns true if anything changed.
function markCodPaidOnDelivery(order, when = new Date()) {
  if (order.payment?.method !== "cod") return false;
  if (order.payment.status === "paid") return false;
  if (!["pending", "initiated"].includes(order.payment.status)) return false;

  order.payment.status = "paid";
  order.payment.amountPaid = order.pricing?.total ?? order.payment.amountPaid;
  order.payment.paidAt = when;
  return true;
}

module.exports = { buildCodPaymentRecord, markCodPaidOnDelivery };
