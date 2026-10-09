const asyncHandler = require("../../middleware/asyncHandler");
const { pushToShiprocket } = require("../../services/order/orderService");
const {
  schedulePickup,
  assignAWB,
  cancelShipment,
} = require("../../services/shipping/shiprocketService");
const Order = require("../../model/Order/orderModel");
const {
  syncActiveShiprocketOrders,
  syncOrderFromShiprocket,
} = require("../../services/shipping/shiprocketSync");

// POST /api/admin/shipping/:orderId/push  — admin triggers shipment creation
const pushOrder = asyncHandler(async (req, res) => {
  const { order, shiprocketResponse } = await pushToShiprocket(
    req.params.orderId,
  );
  res.json({ success: true, order, shiprocketResponse });
});

// POST /api/admin/shipping/pickup  — schedule pickup for multiple shipments
const requestPickup = asyncHandler(async (req, res) => {
  const { shipmentIds } = req.body;
  const data = await schedulePickup(shipmentIds);
  res.json({ success: true, data });
});

// POST /api/admin/shipping/:orderId/awb
const generateAWB = asyncHandler(async (req, res) => {
  const { shipmentId, courierId } = req.body;
  const data = await assignAWB(shipmentId, courierId);
  const order = await Order.findById(req.params.orderId);
  if (order) {
    order.shipping.awbCode = data.awb_code || "";
    order.shipping.trackingNumber = data.awb_code || "";
    order.shipping.trackingUrl = data.routing_code
      ? `https://shiprocket.co/tracking/${data.awb_code}`
      : "";
    await order.save();
  }
  res.json({ success: true, data });
});

// POST /api/shipping/admin/sync  — pull latest status of all pushed orders
const syncAll = asyncHandler(async (req, res) => {
  const result = await syncActiveShiprocketOrders();
  res.json({ success: true, ...result });
});

// POST /api/shipping/admin/:orderId/sync
const syncOne = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });
  const updated = await syncOrderFromShiprocket(order);
  res.json({ success: true, updated, order });
});

module.exports = { pushOrder, requestPickup, generateAWB, syncAll, syncOne };
