const Order = require("../../model/Order/orderModel");
const { createRazorpayOrder } = require("../payment/razorpayService");
const { buildCodPaymentRecord } = require("../payment/codService");
const { createShipment } = require("../shipping/shiprocketService");

// Centralised order creation — used by website checkout AND admin panel
async function createOrder(payload) {
  const {
    items,
    shippingAddress,
    billingAddress,
    billingSameAsShipping,
    pricing,
    coupon,
    payment: paymentInput,
    customerName,
    customerEmail,
    customerPhone,
    customer,
    source,
    customerNote,
    isGift,
    giftMessage,
  } = payload;

  let paymentRecord;
  let razorpayOrderId = null;

  if (paymentInput.method === "cod") {
    paymentRecord = { ...buildCodPaymentRecord() };
  } else if (paymentInput.method === "razorpay") {
    // Create Razorpay order — frontend will open the modal with this ID
    const rzpOrder = await createRazorpayOrder({
      amount: pricing.total,
      receipt: `RJ-${Date.now()}`,
      notes: { customerEmail, customerPhone },
    });
    razorpayOrderId = rzpOrder.id;
    paymentRecord = {
      method: "razorpay",
      status: "initiated",
      gatewayOrderId: rzpOrder.id,
      currency: "INR",
      amountPaid: 0,
    };
  } else {
    throw new Error(`Unsupported payment method: ${paymentInput.method}`);
  }

  const order = await Order.create({
    customer: customer || null,
    customerName,
    customerEmail,
    customerPhone,
    items,
    shippingAddress,
    billingAddress: billingSameAsShipping ? null : billingAddress,
    billingSameAsShipping,
    pricing,
    coupon: coupon || null,
    payment: paymentRecord,
    source: source || "website",
    customerNote,
    isGift,
    giftMessage,
    status: paymentInput.method === "cod" ? "confirmed" : "pending",
    statusHistory: [
      {
        status: paymentInput.method === "cod" ? "confirmed" : "pending",
        note:
          paymentInput.method === "cod"
            ? "COD order auto-confirmed"
            : "Awaiting payment",
        changedBy: "system",
      },
    ],
    confirmedAt: paymentInput.method === "cod" ? new Date() : null,
  });

  return { order, razorpayOrderId };
}

// Mark order as paid after Razorpay verification
async function markOrderPaid(
  orderId,
  { paymentId, signature, gatewayOrderId },
) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  order.payment.status = "paid";
  order.payment.gatewayPaymentId = paymentId;
  order.payment.gatewaySignature = signature;
  order.payment.amountPaid = order.pricing.total;
  order.payment.paidAt = new Date();
  order.status = "confirmed";
  order.confirmedAt = new Date();
  order.statusHistory.push({
    status: "confirmed",
    note: "Payment verified",
    changedBy: "system",
  });

  await order.save();
  return order;
}

// Push order to Shiprocket when admin moves status to ready_to_ship
async function pushToShiprocket(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw new Error("Order not found");

  const srData = await createShipment(order);

  order.shipping.carrierId = String(srData.shipment_id || "");
  order.shipping.carrier = "Shiprocket";
  order.shipping.gatewayResponse = srData;
  order.status = "ready_to_ship";
  order.statusHistory.push({
    status: "ready_to_ship",
    note: "Pushed to Shiprocket",
    changedBy: "system",
  });

  await order.save();
  return { order, shiprocketResponse: srData };
}

module.exports = { createOrder, markOrderPaid, pushToShiprocket };
