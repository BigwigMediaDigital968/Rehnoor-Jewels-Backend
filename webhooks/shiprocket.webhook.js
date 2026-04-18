const Order = require("../model/Order/orderModel");

// Shiprocket sends status updates here — configure the URL in your Shiprocket dashboard
async function shiprocketWebhook(req, res) {
  const { awb, current_status, shipment_id, delivered_date } = req.body;

  const order = await Order.findOne({
    $or: [
      { "shipping.awbCode": awb },
      { "shipping.carrierId": String(shipment_id) },
    ],
  });

  if (!order) return res.status(404).json({ error: "Order not found" });

  const statusMap = {
    DELIVERED: "delivered",
    "OUT FOR DELIVERY": "out_for_delivery",
    SHIPPED: "shipped",
    "PICKUP SCHEDULED": "ready_to_ship",
    CANCELLED: "cancelled",
    "RTO INITIATED": "return_in_transit",
    "RTO DELIVERED": "returned",
  };

  const newStatus = statusMap[current_status?.toUpperCase()];
  if (newStatus && order.status !== newStatus) {
    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      note: `Shiprocket: ${current_status}`,
      changedBy: "system",
    });
    if (newStatus === "delivered")
      order.deliveredAt = delivered_date
        ? new Date(delivered_date)
        : new Date();
    if (newStatus === "shipped") order.shippedAt = new Date();
    await order.save();
  }

  res.json({ received: true });
}

module.exports = shiprocketWebhook;
