const asyncHandler = require("../../middleware/asyncHandler");
const Order = require("../../model/Order/orderModel");
const {
  verifyPaymentSignature,
} = require("../../services/payment/razorpayService");
const { markOrderPaid } = require("../../services/order/orderService");

// POST /api/payments/razorpay/verify
// Called by frontend after Razorpay modal success
const verifyPayment = asyncHandler(async (req, res) => {
  const {
    orderId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = req.body;

  const valid = verifyPaymentSignature({
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  });
  if (!valid)
    return res
      .status(400)
      .json({ success: false, message: "Payment verification failed" });

  const order = await markOrderPaid(orderId, {
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    gatewayOrderId: razorpay_order_id,
  });

  res.json({ success: true, order });
});

module.exports = { verifyPayment };
