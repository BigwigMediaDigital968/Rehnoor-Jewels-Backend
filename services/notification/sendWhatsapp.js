// const client = require("../mail/twilio");
// require('dotenv').config();

// const sendWhatsappOrderConfirmation = async (order) => {
//   try {

//     console.log("TWILIO_WHATSAPP_TEMPLATE_SID:", process.env.TWILIO_WHATSAPP_TEMPLATE_SID);

//     console.log("contentSid:", process.env.TWILIO_WHATSAPP_TEMPLATE_SID);

//     console.log(
//       "contentVariables:",
//       JSON.stringify({
//         1: order.customerName,
//         2: order.orderNumber,
//         3: order.pricing.total,
//         4: order.orderNumber,
//       })
//     );
//     await client.messages.create({

//       contentSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID,
//       contentVariables: JSON.stringify({
//         1: order.customerName,
//         2: order.orderNumber,
//         3: `"${order.pricing.total}"`,
//         4: order.orderNumber
//       }),
//       from: process.env.TWILIO_WHATSAPP_NUMBER,
//       to: `whatsapp:+91${order.customerPhone}`,
//     });

//     await client.messages.create({
//       contentSid: process.env.TWILIO_ADMIN_WHATSAPP_TEMPLATE_SID,
//       contentVariables: JSON.stringify({
//       1: order.orderNumber,
//       2: order.customerName,
//       3: order.customerPhone,
//       4: String(order.pricing.total),
//       5: order.payment.method.toUpperCase(),
//       6: `${order.items.length} item${order.items.length > 1 ? "s" : ""}`,
//     }),
//       from: process.env.TWILIO_WHATSAPP_NUMBER,
//       to: `whatsapp:${process.env.ADMIN_PHONE}`,
//     });
//         // 🛍️ New Order Received on Rehnoor Jewels

//         // Order Number: {{1}}
//         // Customer Name: {{2}}
//         // Customer Phone: {{3}}
//         // Order Amount: ₹{{4}}
//         // Payment Method: {{5}}
//         // Total Items: {{6}}

//         // Please check the admin panel for full order details.
//     console.log(`Whatsapp order confirmation sent to ${order.customerPhone}`);
//   } catch (err) {
//     console.error("Whatsapp Error:", err);
//   }
// };

// module.exports = sendWhatsappOrderConfirmation;

const client = require("../mail/twilio");
require("dotenv").config();

const formatPhone = (phone) => {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length > 10 && digits.startsWith("91")) return `+${digits}`;
  return `+${digits}`;
};

const sendWhatsappOrderConfirmation = async (order) => {
  try {
    const customerPhone = formatPhone(order.customerPhone);
    const rawAdminPhone = process.env.ADMIN_PHONE || "";
    const adminPhone = formatPhone(rawAdminPhone);

    const senderWhatsapp = process.env.TWILIO_WHATSAPP_NUMBER?.startsWith(
      "whatsapp:",
    )
      ? process.env.TWILIO_WHATSAPP_NUMBER
      : `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

    // 1. Send Customer WhatsApp Notification
    if (customerPhone) {
      const resCustomer = await client.messages.create({
        contentSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID,
        contentVariables: JSON.stringify({
          1: String(order.customerName || "Customer"),
          2: String(order.orderNumber || "N/A"),
          3: String(order.pricing?.total || 0),
          4: String(order.orderNumber || "N/A"),
        }),
        from: senderWhatsapp,
        to: `whatsapp:${customerPhone}`,
      });
      console.log(`[WhatsApp Customer Success] SID: ${resCustomer.sid}`);
    }

    // 2. Send Admin WhatsApp Notification
    if (adminPhone && process.env.TWILIO_ADMIN_WHATSAPP_TEMPLATE_SID) {
      const resAdmin = await client.messages.create({
        contentSid: process.env.TWILIO_ADMIN_WHATSAPP_TEMPLATE_SID,
        contentVariables: JSON.stringify({
          1: String(order.orderNumber || "N/A"),
          2: String(order.customerName || "Customer"),
          3: String(customerPhone),
          4: String(order.pricing?.total || 0),
          5: String(order.payment?.method || "COD").toUpperCase(),
          6: `${order.items?.length || 0} item(s)`,
        }),
        from: senderWhatsapp,
        to: `whatsapp:${adminPhone}`,
      });
      console.log(`[WhatsApp Admin Success] SID: ${resAdmin.sid}`);
    }
  } catch (err) {
    console.error("[WhatsApp Failed Detail]:", err.code, err.message);
    throw err; // Re-throw so Promise.allSettled logs rejection reason
  }
};

module.exports = sendWhatsappOrderConfirmation;
