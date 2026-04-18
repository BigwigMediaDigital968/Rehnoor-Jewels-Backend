// COD orders are confirmed immediately — no gateway needed
function buildCodPaymentRecord() {
  return {
    method: "cod",
    status: "pending", // becomes "paid" on delivery
    amountPaid: 0,
    currency: "INR",
  };
}

module.exports = { buildCodPaymentRecord };
