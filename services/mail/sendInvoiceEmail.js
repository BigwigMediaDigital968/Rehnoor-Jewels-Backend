const axios = require("axios");

const BREVO_BASE = "https://api.brevo.com/v3";

const brevoHeaders = () => ({
  accept: "application/json",
  "api-key": process.env.BREVO_API_KEY,
  "content-type": "application/json",
});

const sendInvoiceEmail = async (order) => {
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td>${item.productName}</td>
        <td>${item.quantity}</td>
        <td>₹${item.unitPrice}</td>
        <td>₹${item.lineTotal}</td>
      </tr>
    `,
    )
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rehnoor Jewels Invoice</title>
</head>
<body style="margin:0;padding:40px 20px;background:#F9F6EE;font-family:Georgia,serif;display:flex;justify-content:center;">

  <div style="width: 100%; max-width: 600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); box-sizing: border-box;">
    
    <div style="background:#003720; padding:40px 48px; text-align:center;">
      <h1 style="color:#FCC131; font-size:28px; margin:0; letter-spacing:2px; font-weight:400;">
        REHNOOR JEWELS
      </h1>
      <p style="color:rgba(255,255,255,0.65); margin:8px 0 0; font-size:13px; letter-spacing:3px; text-transform:uppercase;">
        Order Confirmed
      </p>
    </div>

    <div style="padding:48px 48px 24px; box-sizing: border-box;">
      
      <p style="color:#555; line-height:1.8; font-size:15px; margin:0;">
        Hello \${order.customerName},
      </p>
      <p style="color:#555; line-height:1.8; font-size:15px; margin:8px 0 0;">
        Thank you for your purchase. We are preparing your timeless pieces with the utmost care and attention.
      </p>
    </div>

    <div style="padding:0 48px 24px; box-sizing: border-box;">
      <div style="border-bottom: 1px solid #E5E0D4; padding-bottom: 12px; margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px;">
        <div style="min-width: 200px;">
          <h3 style="color: #003720; font-size: 14px; margin: 0 0 4px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">
            Order Summary
          </h3>
          <span style="color: #D4A017; font-size: 13px; font-weight: 600; letter-spacing: 1px; display: inline-block;">
            Order ID: #\${order.orderNumber}
          </span>
        </div>
        <div style="margin-top: 4px;">
          <a href="http://rehnoorjewels.com/track-order?id=\${order.orderNumber}"
            style="color: #003720; text-decoration: none; font-size: 13px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid #003720; padding-bottom: 2px; display: inline-block;">
            Track Order &rarr;
          </a>
        </div>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px; color:#555;">
        <thead>
          <tr style="color:#003720; font-weight:600;">
            <th align="left" style="padding:10px 0; border-bottom:2px solid #003720;">Product</th>
            <th align="center" style="padding:10px 0; border-bottom:2px solid #003720;">Qty</th>
            <th align="right" style="padding:10px 0; border-bottom:2px solid #003720;">Price</th>
            <th align="right" style="padding:10px 0; border-bottom:2px solid #003720;">Total</th>
          </tr>
        </thead>
        <tbody>
          \${itemsHtml}
        </tbody>
      </table>
    </div>

    <div style="padding: 0 48px 32px; display: flex; justify-content: flex-end; box-sizing: border-box;">
      <div style="width: 100%; max-width: 240px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #777;">Subtotal</span>
          <span style="color: #333;">₹\${order.pricing.subtotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #777;">Shipping</span>
          <span style="color: #333;">₹\${order.pricing.shippingCharge}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #777;">Discount</span>
          <span style="color: #B81D24;">-₹\${order.pricing.discountAmount}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 12px 0 0; margin-top: 4px; border-top: 1px solid #E5E0D4; font-size: 16px; font-weight: 600;">
          <span style="color: #003720;">Total</span>
          <span style="color: #D4A017;">₹\${order.pricing.total}</span>
        </div>
      </div>
    </div>

    <div style="padding: 0 48px 24px; box-sizing: border-box;">
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
        <div style="flex: 1; min-width: 240px; background: #F9F6EE; border-radius: 12px; padding: 20px; box-sizing: border-box; line-height: 1.6; color: #555;">
          <h4 style="color: #003720; font-size: 13px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
            Customer Details
          </h4>
          <strong style="color: #1a1a1a; display: block; margin-bottom: 2px;">\${order.customerName}</strong>
          \${order.customerEmail}<br>
          \${order.customerPhone}
        </div>
        <div style="flex: 1; min-width: 240px; background: #F9F6EE; border-radius: 12px; padding: 20px; box-sizing: border-box; line-height: 1.6; color: #555;">
          <h4 style="color: #003720; font-size: 13px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
            Shipping Address
          </h4>
          <strong style="color: #1a1a1a; display: block; margin-bottom: 2px;">\${order.shippingAddress?.fullName || ""}</strong>
          \${order.shippingAddress?.addressLine1 || ""}<br>
          \${order.shippingAddress?.addressLine2 ? order.shippingAddress.addressLine2 + '<br>' : ''}
          \${order.shippingAddress?.city || ""}, \text{\${order.shippingAddress?.state || ""}} - \${order.shippingAddress?.postalCode || ""}
        </div>
      </div>

      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; border-top: 1px dashed #E5E0D4; padding: 20px 0; color: #555;">
        <div><strong>Payment Method:</strong> \${order.payment?.method}</div>
        <div><strong>Order Status:</strong> <span style="color: #003720; font-weight: 600;">\${order.status}</span></div>
      </div>
    </div>

    <div style="background:#F9F6EE; padding:24px 48px; text-align:center; border-top:1px solid #E5E0D4; box-sizing: border-box;">
      <p style="color:#888; font-size:13px; margin:0;">
        Thank you for choosing Rehnoor Jewels.
      </p>
      <p style="color:#aaa; font-size:12px; margin:8px 0 0; line-height: 1.5;">
        If you have any questions regarding your order, simply reply to this email.
      </p>
      <p style="color:#aaa; font-size:12px; margin:10px 0 0;">
        Rehnoor Jewels • New Delhi, India
      </p>
    </div>

  </div>

</body>
</html>`;

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME || "Store",
    },

    to: [
      {
        email: order.customerEmail,
        name: order.customerName,
      },
    ],

    subject: `Invoice - ${order.orderNumber}`,

    htmlContent,
  };

  const res = await axios.post(`${BREVO_BASE}/smtp/email`, payload, {
    headers: brevoHeaders(),
  });
  console.log(res);
};

module.exports = sendInvoiceEmail;