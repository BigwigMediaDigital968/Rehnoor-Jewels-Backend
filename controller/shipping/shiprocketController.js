const asyncHandler = require("../../middleware/asyncHandler");
const { pushToShiprocket } = require("../../services/order/orderService");
const {
  schedulePickup,
  assignAWB,
  cancelShipment,
} = require("../../services/shipping/shiprocketService");
const Order = require("../../model/Order/orderModel");

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

module.exports = { pushOrder, requestPickup, generateAWB };
