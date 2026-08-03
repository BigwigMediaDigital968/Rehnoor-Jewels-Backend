const client = require("../mail/twilio");
require('dotenv').config();

const sendWhatsappOrderConfirmation = async (order) => {
  try {
    //     await client.messages.create({
    //       body: `Hi ${order.customerName},

    // Your order ${order.orderNumber} has been placed successfully.

    // Amount: ₹${order.pricing.total}

    // Track:
    // https://rehnoorjewels.com/track-order?id=${order.orderNumber}

    // Thank you for shopping with Rehnoor Jewels.`,
    //       from: process.env.TWILIO_WHATSAPP_NUMBER,
    //       to: `whatsapp:+91${order.customerPhone}`,
    //     });

    console.log("TWILIO_WHATSAPP_TEMPLATE_SID:", process.env.TWILIO_WHATSAPP_TEMPLATE_SID);

    console.log("contentSid:", process.env.TWILIO_WHATSAPP_TEMPLATE_SID);

    console.log(
      "contentVariables:",
      JSON.stringify({
        1: order.customerName,
        2: order.orderNumber,
        3: order.pricing.total,
        4: order.orderNumber,
      })
    );
    await client.messages.create({

      contentSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        1: order.customerName,
        2: order.orderNumber,
        3: `"${order.pricing.total}"`,
        4: order.orderNumber
      }),
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:+91${order.customerPhone}`,
    });

    await client.messages.create({
      contentSid: process.env.TWILIO_ADMIN_WHATSAPP_TEMPLATE_SID,
      contentVariables: JSON.stringify({
      1: order.orderNumber,
      2: order.customerName,
      3: order.customerPhone,
      4: String(order.pricing.total),
      5: order.payment.method.toUpperCase(),
      6: `${order.items.length} item${order.items.length > 1 ? "s" : ""}`,
    }),
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: `whatsapp:${process.env.ADMIN_PHONE}`,
    });
        // 🛍️ New Order Received on Rehnoor Jewels

        // Order Number: {{1}}
        // Customer Name: {{2}}
        // Customer Phone: {{3}}
        // Order Amount: ₹{{4}}
        // Payment Method: {{5}}
        // Total Items: {{6}}

        // Please check the admin panel for full order details.
    console.log(`Whatsapp order confirmation sent to ${order.customerPhone}`);
  } catch (err) {
    console.error("Whatsapp Error:", err);
  }
};

module.exports = sendWhatsappOrderConfirmation;
