const axios = require("axios");

const sendAdminOrderNotification = async (order) => {
  const htmlContent = `
    <h2>🎉 New Order Received</h2>

    <p><strong>Order:</strong> ${order.orderNumber}</p>
    <p><strong>Customer:</strong> ${order.customerName}</p>
    <p><strong>Email:</strong> ${order.customerEmail}</p>
    <p><strong>Phone:</strong> ${order.customerPhone}</p>
    <p><strong>Amount:</strong> ₹${order.pricing.total}</p>
    <p><strong>Payment:</strong> ${order.payment.method}</p>

    <p>
      <a href="https://rehnoor-jewels-admin-panel.vercel.app/admin/order-management">
        View Order Management
      </a>
    </p>
  `;

  await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: "Rehnoor Jewels",
      },
      to: [
        {
          email: process.env.ADMIN_EMAIL,
          name: "Rehnoor Admin",
        },
      ],
      subject: `🛍️ New Order ${order.orderNumber}`,
      htmlContent,
    },
    {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
    },
  );
};

module.exports = sendAdminOrderNotification;
