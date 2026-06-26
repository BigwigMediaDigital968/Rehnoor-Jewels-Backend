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

async function createShipment(order) {
  const client = await srClient();
  const sa = order.shippingAddress;

  const shipping = order.shippingAddress;
  const billing = order.billingSameAsShipping
    ? order.shippingAddress
    : order.billingAddress;

  // const payload = {
  //   order_id: order.orderNumber,
  //   order_date: new Date(order.placedAt).toISOString().split("T")[0],
  //   pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
  //   billing_customer_name: sa.fullName,
  //   billing_last_name: "",
  //   billing_address: sa.addressLine1,
  //   billing_address_2: sa.addressLine2 || "",
  //   billing_city: sa.city,
  //   billing_pincode: sa.pincode,
  //   billing_state: sa.state,
  //   billing_country: sa.country || "India",
  //   billing_email: order.customerEmail,
  //   billing_phone: sa.phone,
  //   shipping_is_billing: order.billingSameAsShipping ? 1 : 0,
  //   order_items: order.items.map((i) => ({
  //     name: i.name,
  //     sku: i.sku || String(i.product),
  //     units: i.quantity,
  //     selling_price: i.unitPrice,
  //     discount: i.originalPrice ? i.originalPrice - i.unitPrice : 0,
  //     hsn: 711319, // ← HSN code for gold jewellery — required by Shiprocket
  //   })),
  //   payment_method: order.payment.method === "cod" ? "COD" : "Prepaid",
  //   sub_total: order.pricing.subtotal,
  //   length: 10,
  //   breadth: 10,
  //   height: 5,
  //   weight: 0.3,
  // };

  // Log the full payload so you can see exactly what's being sent

  const payload = {
    order_id: order.orderNumber,
    order_date: new Date(order.placedAt).toISOString().split("T")[0],

    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",

    // Billing Details
    billing_customer_name: billing.fullName,
    billing_last_name: "",
    billing_address: billing.addressLine1,
    billing_address_2: billing.addressLine2 || "",
    billing_city: billing.city,
    billing_pincode: billing.pincode,
    billing_state: billing.state,
    billing_country: billing.country || "India",
    billing_email: order.customerEmail,
    billing_phone: billing.phone,

    // Shipping Details
    shipping_customer_name: shipping.fullName,
    shipping_last_name: "",
    shipping_address: shipping.addressLine1,
    shipping_address_2: shipping.addressLine2 || "",
    shipping_city: shipping.city,
    shipping_pincode: shipping.pincode,
    shipping_state: shipping.state,
    shipping_country: shipping.country || "India",
    shipping_email: order.customerEmail,
    shipping_phone: shipping.phone,

    shipping_is_billing: order.billingSameAsShipping ? 1 : 0,

    order_items: order.items.map((i) => ({
      name: i.name,
      sku: i.sku || String(i.product),
      units: i.quantity,
      selling_price: i.unitPrice,
      discount: i.originalPrice ? i.originalPrice - i.unitPrice : 0,
      hsn: 711319,
    })),

    payment_method: order.payment.method === "cod" ? "COD" : "Prepaid",

    sub_total: order.pricing.subtotal,
    length: 10,
    breadth: 10,
    height: 5,
    weight: 0.3,
  };

  console.log("Shiprocket payload:", JSON.stringify(payload, null, 2));

  try {
    const { data } = await client.post("/orders/create/adhoc", payload);
    return data;

    console.log("response", data);
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

// Get available couriers
// Try First
async function getAvailableCouriers(shipmentId) {
  const client = await srClient();

  const { data } = await client.get(
    `/courier/serviceability/shipment/${shipmentId}`,
  );

  return data;
}
// Or use this
// const { data } = await client.get(
//   `/courier/serviceability`,
//   {
//     params: {
//       shipment_id: shipmentId,
//     },
//   }
// );

// Request a courier pickup

async function schedulePickup(shipmentIds) {
  const client = await srClient();

  try {
    const { data } = await client.post("/courier/generate/pickup", {
      shipment_id: shipmentIds,
    });

    return data;
  } catch (err) {
    console.log("Pickup Error:", JSON.stringify(err.response?.data, null, 2));
    throw err;
  }
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
