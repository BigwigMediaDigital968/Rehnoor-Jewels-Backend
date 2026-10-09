const axios = require("axios");
const Order = require("../../model/Order/orderModel");
const { getShiprocketToken, SR_BASE } = require("../../config/shiprocket");

// Our order statuses that still follow the Shiprocket shipment. Delivered,
// returned, refunded and cancelled orders are final and never overwritten.
const ACTIVE_STATUSES = [
  "confirmed",
  "processing",
  "ready_to_ship",
  "shipped",
  "out_for_delivery",
  "return_in_transit",
];

const FORWARD_RANK = {
  confirmed: 0,
  processing: 0,
  ready_to_ship: 1,
  shipped: 2,
  out_for_delivery: 3,
  delivered: 4,
};

// Shiprocket status text → our order status. "shipment_cancelled" is handled
// separately: the shipment is gone but the customer's order is not.
function mapShiprocketStatus(srStatus) {
  const s = String(srStatus || "").toUpperCase().trim();
  if (!s) return null;
  if (s.includes("RTO"))
    return s.includes("DELIVERED") ? "returned" : "return_in_transit";
  if (s === "CANCELED" || s === "CANCELLED") return "shipment_cancelled";
  if (s === "DELIVERED") return "delivered";
  if (s.includes("OUT FOR DELIVERY")) return "out_for_delivery";
  if (/LOST|DAMAGED|DESTROYED|DISPOSED/.test(s)) return null;
  if (
    s.includes("PICKED UP") ||
    s.includes("TRANSIT") ||
    s.includes("SHIPPED") ||
    s.includes("REACHED") ||
    s.includes("DESTINATION") ||
    s.includes("UNDELIVERED") ||
    s.includes("DELAYED")
  )
    return "shipped";
  // NEW, AWB ASSIGNED, PICKUP SCHEDULED, OUT FOR PICKUP, READY TO SHIP …
  return "ready_to_ship";
}

// Applies a Shiprocket status to an order document. Returns true if changed.
function applyShiprocketStatus(order, { status, awb, courierName, at }) {
  if (!ACTIVE_STATUSES.includes(order.status)) return false;
  let changed = false;

  if (awb && order.shipping.awbCode !== String(awb)) {
    order.shipping.awbCode = String(awb);
    order.shipping.trackingNumber = String(awb);
    order.shipping.trackingUrl = `https://shiprocket.co/tracking/${awb}`;
    changed = true;
  }
  if (courierName && order.shipping.courierName !== courierName) {
    order.shipping.courierName = courierName;
    changed = true;
  }

  const mapped = mapShiprocketStatus(status);
  if (!mapped) return changed;

  if (mapped === "shipment_cancelled") {
    if (!order.shipping.carrierId) return changed;
    // Free the order so it can be pushed again; remember the cancelled
    // Shiprocket order so the re-push uses a fresh channel order id.
    const prev = order.shipping.gatewayResponse || {};
    order.shipping.gatewayResponse = {
      cancelledShipments: [
        ...(prev.cancelledShipments || []),
        prev.order_id || order.shipping.carrierId,
      ],
    };
    order.shipping.carrierId = "";
    order.shipping.awbCode = "";
    order.shipping.trackingNumber = "";
    order.shipping.trackingUrl = "";
    order.shipping.courierName = "";
    order.status = "confirmed";
    order.statusHistory.push({
      status: "confirmed",
      note: "Shipment cancelled in Shiprocket — can be pushed again",
      changedBy: "system",
    });
    return true;
  }

  const isReturn = mapped === "return_in_transit" || mapped === "returned";
  const forward =
    (FORWARD_RANK[mapped] ?? -1) > (FORWARD_RANK[order.status] ?? -1);
  if (mapped !== order.status && (isReturn || forward)) {
    order.status = mapped;
    order.statusHistory.push({
      status: mapped,
      note: `Shiprocket: ${status}`,
      changedBy: "system",
    });
    const when = at ? new Date(at) : new Date();
    if (mapped === "shipped" && !order.shippedAt) order.shippedAt = when;
    if (mapped === "delivered") {
      order.deliveredAt = when;
      order.shipping.deliveredAt = when;
    }
    if (mapped === "returned") order.returnedAt = when;
    changed = true;
  }
  return changed;
}

// Pull the current state of one order from Shiprocket and apply it.
async function syncOrderFromShiprocket(order, token) {
  const srOrderId = order.shipping?.gatewayResponse?.order_id;
  if (!srOrderId || !order.shipping?.carrierId) return false;

  const { data } = await axios.get(`${SR_BASE}/orders/show/${srOrderId}`, {
    headers: { Authorization: `Bearer ${token || (await getShiprocketToken())}` },
    timeout: 10000,
  });
  const d = data?.data || {};
  const changed = applyShiprocketStatus(order, {
    status: d.status,
    awb: d.awb_data?.awb || d.shipments?.awb,
    courierName: d.shipments?.courier || d.awb_data?.courier_name,
  });
  if (changed) await order.save();
  return changed;
}

// Sync every pushed order that is still in progress.
async function syncActiveShiprocketOrders() {
  const orders = await Order.find({
    status: { $in: ACTIVE_STATUSES },
    "shipping.carrierId": { $nin: ["", null] },
  });
  if (!orders.length) return { checked: 0, updated: 0 };

  const token = await getShiprocketToken();
  let updated = 0;
  for (const order of orders) {
    try {
      if (await syncOrderFromShiprocket(order, token)) updated++;
    } catch (err) {
      console.error(
        `[Shiprocket Sync] ${order.orderNumber} failed:`,
        err.response?.data || err.message,
      );
    }
  }
  console.log(
    `[Shiprocket Sync] checked ${orders.length}, updated ${updated}`,
  );
  return { checked: orders.length, updated };
}

module.exports = {
  mapShiprocketStatus,
  applyShiprocketStatus,
  syncOrderFromShiprocket,
  syncActiveShiprocketOrders,
};
