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
    console.log(`Whatsapp order confirmation sent to ${order.customerPhone}`);
  } catch (err) {
    console.error("Whatsapp Error:", err);
  }
};

module.exports = sendWhatsappOrderConfirmation;
