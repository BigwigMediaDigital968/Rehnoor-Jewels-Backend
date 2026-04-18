const crypto = require("crypto");
const Order = require("../model/Order/orderModel");

// Mount BEFORE express.json() in app.js:
// app.post("/webhooks/razorpay", express.raw({ type: "application/json" }), razorpayWebhook);

async function razorpayWebhook(req, res) {
  const sig = req.headers["x-razorpay-signature"];
  const body = req.body; // raw Buffer

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== sig)
    return res.status(400).json({ error: "Invalid signature" });

  const event = JSON.parse(body);

  if (event.event === "payment.captured") {
    const { order_id, id: payment_id, amount } = event.payload.payment.entity;
    const order = await Order.findOne({ "payment.gatewayOrderId": order_id });
    if (order && order.payment.status !== "paid") {
      order.payment.status = "paid";
      order.payment.gatewayPaymentId = payment_id;
      order.payment.amountPaid = amount / 100;
      order.payment.paidAt = new Date();
      order.payment.gatewayResponse = event.payload;
      order.status = "confirmed";
      order.confirmedAt = new Date();
      order.statusHistory.push({
        status: "confirmed",
        note: "Confirmed via Razorpay webhook",
        changedBy: "system",
      });
      await order.save();
    }
  }

  if (event.event === "payment.failed") {
    const { order_id } = event.payload.payment.entity;
    const order = await Order.findOne({ "payment.gatewayOrderId": order_id });
    if (order) {
      order.payment.status = "failed";
      order.status = "failed";
      order.statusHistory.push({
        status: "failed",
        note: "Payment failed (webhook)",
        changedBy: "system",
      });
      await order.save();
    }
  }

  if (event.event === "refund.processed") {
    const { payment_id, id: refund_id, amount } = event.payload.refund.entity;
    const order = await Order.findOne({
      "payment.gatewayPaymentId": payment_id,
    });
    if (order) {
      order.payment.refundId = refund_id;
      order.payment.refundAmount = amount / 100;
      order.payment.refundedAt = new Date();
      order.payment.status = "refunded";
      order.status = "refunded";
      order.refundedAt = new Date();
      order.statusHistory.push({
        status: "refunded",
        note: "Refund confirmed via webhook",
        changedBy: "system",
      });
      await order.save();
    }
  }

  res.json({ received: true });
}

module.exports = razorpayWebhook;
