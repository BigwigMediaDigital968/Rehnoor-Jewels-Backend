const client = require("./twilio");

const sendAdminWhatsApp = async (order) => {
  const products = order.items
    .map(
      (item) =>
        `• ${item.name}
Qty: ${item.quantity}
₹${item.lineTotal}`,
    )
    .join("\n\n");

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: `whatsapp:+${process.env.ADMIN_PHONE}`,
    body: `
🛍️ NEW ORDER RECEIVED

${products}

Order: ${order.orderNumber}

Customer:
${order.customerName}

Phone:
${order.customerPhone}

Amount:
₹${order.pricing.total}

Payment:
${order.payment.method.toUpperCase()}

`,
  });
};

module.exports = sendAdminWhatsApp;
