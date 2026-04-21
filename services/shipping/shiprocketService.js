const axios = require("axios");
const { getShiprocketToken, SR_BASE } = require("../../config/shiprocket");

async function srClient() {
  const token = await getShiprocketToken();
  return axios.create({
    baseURL: SR_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

// Create a shipment order on Shiprocket
// async function createShipment(order) {
//   const client = await srClient();
//   const sa = order.shippingAddress;

//   const payload = {
//     order_id: order.orderNumber,
//     order_date: new Date(order.placedAt).toISOString().split("T")[0],
//     pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
//     billing_customer_name: sa.fullName,
//     billing_last_name: "",
//     billing_address: sa.addressLine1,
//     billing_address_2: sa.addressLine2,
//     billing_city: sa.city,
//     billing_pincode: sa.pincode,
//     billing_state: sa.state,
//     billing_country: sa.country,
//     billing_email: order.customerEmail,
//     billing_phone: sa.phone,
//     shipping_is_billing: order.billingSameAsShipping,
//     order_items: order.items.map((i) => ({
//       name: i.name,
//       sku: i.sku || i.product.toString(),
//       units: i.quantity,
//       selling_price: i.unitPrice,
//       discount: i.originalPrice ? i.originalPrice - i.unitPrice : 0,
//       hsn: "",
//     })),
//     payment_method: order.payment.method === "cod" ? "COD" : "Prepaid",
//     sub_total: order.pricing.subtotal,
//     length: 10, // cm — override per product if needed
//     breadth: 10,
//     height: 5,
//     weight: 0.3, // kg
//   };

//   const { data } = await client.post("/orders/create/adhoc", payload);
//   return data; // { order_id, shipment_id, status, ... }
// }
async function createShipment(order) {
  const client = await srClient();
  const sa = order.shippingAddress;

  const payload = {
    order_id: order.orderNumber,
    order_date: new Date(order.placedAt).toISOString().split("T")[0],
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    billing_customer_name: sa.fullName,
    billing_last_name: "",
    billing_address: sa.addressLine1,
    billing_address_2: sa.addressLine2 || "",
    billing_city: sa.city,
    billing_pincode: sa.pincode,
    billing_state: sa.state,
    billing_country: sa.country || "India",
    billing_email: order.customerEmail,
    billing_phone: sa.phone,
    shipping_is_billing: order.billingSameAsShipping ? 1 : 0,
    order_items: order.items.map((i) => ({
      name: i.name,
      sku: i.sku || String(i.product),
      units: i.quantity,
      selling_price: i.unitPrice,
      discount: i.originalPrice ? i.originalPrice - i.unitPrice : 0,
      hsn: 711319, // ← HSN code for gold jewellery — required by Shiprocket
    })),
    payment_method: order.payment.method === "cod" ? "COD" : "Prepaid",
    sub_total: order.pricing.subtotal,
    length: 10,
    breadth: 10,
    height: 5,
    weight: 0.3,
  };

  // Log the full payload so you can see exactly what's being sent
  console.log("Shiprocket payload:", JSON.stringify(payload, null, 2));

  try {
    const { data } = await client.post("/orders/create/adhoc", payload);
    return data;
  } catch (err) {
    console.error(
      "Shiprocket createShipment error:",
      JSON.stringify(err.response?.data, null, 2),
    );
    throw new Error(
      `Shiprocket order creation failed: ${JSON.stringify(err.response?.data?.message || err.message)}`,
    );
  }
}

// Request a courier pickup
async function schedulePickup(shipmentIds) {
  const client = await srClient();
  const { data } = await client.post("/courier/generate/pickup", {
    shipment_id: shipmentIds,
  });
  return data;
}

// Generate AWB (Airway Bill) for a shipment
async function assignAWB(shipmentId, courierId) {
  const client = await srClient();
  const { data } = await client.post("/courier/assign/awb", {
    shipment_id: shipmentId,
    courier_id: courierId,
  });
  return data;
}

// Cancel a shipment
async function cancelShipment(orderIds) {
  const client = await srClient();
  const { data } = await client.post("/orders/cancel", { ids: orderIds });
  return data;
}

module.exports = { createShipment, schedulePickup, assignAWB, cancelShipment };
