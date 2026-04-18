const razorpay = require("../../config/razorpay");
const crypto = require("crypto");

// 1. Create a Razorpay order (called before the customer sees the payment modal)
async function createRazorpayOrder({
  amount,
  currency = "INR",
  receipt,
  notes = {},
}) {
  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100), // paise
    currency,
    receipt,
    notes,
  });
  return order; // { id, amount, currency, receipt, status }
}

// 2. Verify webhook / callback signature
function verifyPaymentSignature({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expected === razorpay_signature;
}

// 3. Fetch payment details from Razorpay
async function fetchPaymentDetails(paymentId) {
  return razorpay.payments.fetch(paymentId);
}

// 4. Issue a refund
async function initiateRefund(paymentId, amount, reason = "") {
  return razorpay.payments.refund(paymentId, {
    amount: Math.round(amount * 100),
    notes: { reason },
  });
}

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchPaymentDetails,
  initiateRefund,
};
