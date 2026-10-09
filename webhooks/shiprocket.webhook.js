const Order = require("../model/Order/orderModel");
const {
  applyShiprocketStatus,
} = require("../services/shipping/shiprocketSync");

// Shiprocket tracking webhook. Configure it in Shiprocket → Settings → API →
// Webhooks using /api/courier-updates — Shiprocket rejects webhook URLs that
// contain "shiprocket", "kartrocket", "sr" or "kr".
async function shiprocketWebhook(req, res) {
  try {
    await handleTrackingUpdate(req, res);
  } catch (err) {
    console.error("[Shiprocket Tracking Webhook Error]:", err);
    // 200 so Shiprocket stops retrying a payload we cannot process.
    if (!res.headersSent) res.status(200).json({ received: false });
  }
}

async function handleTrackingUpdate(req, res) {
  const {
    awb,
    current_status,
    shipment_status,
    courier_name,
    order_id,
    sr_order_id,
    shipment_id,
    current_timestamp,
  } = req.body || {};

  const or = [];
  if (awb) or.push({ "shipping.awbCode": String(awb) });
  if (sr_order_id) or.push({ "shipping.gatewayResponse.order_id": Number(sr_order_id) });
  if (shipment_id) or.push({ "shipping.carrierId": String(shipment_id) });
  // order_id is our channel order id; a re-push carries a "-R<n>" suffix
  if (order_id) or.push({ orderNumber: String(order_id).replace(/-R\d+$/, "") });

  const order = or.length ? await Order.findOne({ $or: or }) : null;

  // Always 200 — Shiprocket disables webhooks that keep failing.
  if (!order) {
    console.warn(
      `[Shiprocket Tracking Webhook] No order for awb=${awb} order_id=${order_id}`,
    );
    return res.status(200).json({ received: true, matched: false });
  }

  const changed = applyShiprocketStatus(order, {
    status: current_status || shipment_status,
    awb,
    courierName: courier_name,
    at: current_timestamp,
  });
  if (changed) await order.save();

  res.status(200).json({ received: true });
}

module.exports = shiprocketWebhook;
