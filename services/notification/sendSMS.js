// const client = require("../mail/twilio");

// const sendSMSOrderConfirmation = async (order) => {
//   try {
//     await client.messages.create({
//       body: `Hi ${order.customerName},

// Your order ${order.orderNumber} has been confirmed!.

// Amount: ₹${order.pricing.total}

// Track:
// https://rehnoorjewels.com/track-order?id=${order.orderNumber}

// Thank you for shopping with Rehnoor Jewels.`,
//       from: process.env.TWILIO_PHONE_NUMBER,
//       to: `+91${order.customerPhone}`,
//     });
//     console.log(`SMS order confirmation sent to ${order.customerPhone}`);
//   } catch (err) {
//     console.error("SMS Error:", err.message);
//   }
// };

// module.exports = sendSMSOrderConfirmation;

const client = require("../mail/twilio");

const sendSMSOrderConfirmation = async (order) => {
  try {
    let digits = String(order.customerPhone).replace(/\D/g, "");
    const recipientPhone = digits.length === 10 ? `+91${digits}` : `+${digits}`;

    const response = await client.messages.create({
      body: `Hi ${order.customerName}, Your order #${order.orderNumber} for Rs. ${order.pricing.total} has been confirmed on Rehnoor Jewels!`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: recipientPhone,
    });

    console.log("[SMS Sent Success]:", response.status, "SID:", response.sid);
    return response.sid;
  } catch (err) {
    console.error("[SMS Failed Detail]:", err.code, err.message, err.moreInfo);
    throw err;
  }
};

module.exports = sendSMSOrderConfirmation;
