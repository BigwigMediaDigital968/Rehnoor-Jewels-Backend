const client = require("../mail/twilio");

const sendSMSOrderConfirmation = async (order) => {
  try {
    await client.messages.create({
      body: `Hi ${order.customerName},

Your order ${order.orderNumber} has been placed successfully.

Amount: ₹${order.pricing.total}

Track:
https://rehnoorjewels.com/track-order?id=${order.orderNumber}

Thank you for shopping with Rehnoor Jewels.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${order.customerPhone}`,
    });
  } catch (err) {
    console.error("SMS Error:", err.message);
  }
};

module.exports = sendSMSOrderConfirmation;
