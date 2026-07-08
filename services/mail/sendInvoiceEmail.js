const axios = require("axios");

const BREVO_BASE = "https://api.brevo.com/v3";

const brevoHeaders = () => ({
  accept: "application/json",
  "api-key": process.env.BREVO_API_KEY,
  "content-type": "application/json",
});

const sendInvoiceEmail = async (order) => {
  // console.log(order);
  const itemsHtml = order.items
    .map(
      (item) => `
<tr>
  <td
    style="
      padding:15px;
      border-top:1px solid #eee;
    "
  >
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td width="70" valign="top">
          <img
            src="${item.image}"
            width="60"
            height="60"
            style="
              display:block;
              border-radius:8px;
              object-fit:cover;
            "
          />
        </td>

        

        <td valign="middle" style="padding-left:12px;">
          <div
            style="
              font-size:14px;
              color:#222;
              font-weight:600;
              line-height:20px;
            "
          >
            ${item.name}
          </div>

          ${
            item.sku
              ? `
          <div
            style="
              color:#888;
              font-size:12px;
              margin-top:4px;
            "
          >
            SKU: ${item.sku}
          </div>
          `
              : ""
          }

          ${
            item.slug
              ? `
              <div style="margin-top:5px;">
              <a href="https://rehnoorjewels.com/product/${item.slug}"
              style="
              color:#003720; 
              text-decoration:none;
              font-size:12px;
              "
              >
              View Product →
              </a>
              </div>
              `
              : ""
          }
        </td>
      </tr>
    </table>
  </td>

  <td
    align="center"
    style="
      border-top:1px solid #eee;
      font-size:14px;
    "
  >
    ${item.quantity}
  </td>

  <td
    align="right"
    style="
      border-top:1px solid #eee;
      font-size:14px;
    "
  >
    ₹${item.unitPrice}
  </td>

  <td
    align="right"
    style="
      border-top:1px solid #eee;
      font-size:14px;
      font-weight:600;
    "
  >
    ₹${item.lineTotal}
  </td>
</tr>
`,
    )
    .join("");

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Order Confirmation</title>
</head>

<body style="margin:0;padding:0;background:#f8f6f2;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8f6f2">
<tr>
<td align="center" style="padding:30px 15px;">

<table width="600" cellpadding="0" cellspacing="0" border="0"
style="background:#ffffff;border-radius:16px;overflow:hidden;">

<!-- HEADER -->
<tr>
<td align="center"
style="background:#003720;padding:40px 30px;">
<h1 style="
margin:0;
font-size:32px;
color:#FCC131;
font-weight:bold;
letter-spacing:2px;
">
REHNOOR JEWELS
</h1>

<p style="
margin-top:12px;
font-size:13px;
letter-spacing:3px;
text-transform:uppercase;
color:#ffffff;
opacity:0.8;
">
Order Confirmed
</p>
</td>
</tr>

<!-- GREETING -->
<tr>
<td style="padding:40px 40px 20px;">
<p style="
margin:0;
font-size:16px;
color:#333;
line-height:28px;
">
Hello <strong>${order.customerName}</strong>,
</p>

<p style="
font-size:15px;
line-height:28px;
color:#555;
margin-top:15px;
">
Thank you for shopping with Rehnoor Jewels.
Your order has been successfully placed and we have started preparing your jewellery with utmost care.
</p>
</td>
</tr>

<!-- ORDER SUMMARY -->
<tr>
<td style="padding:0 40px 30px;">

<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td>
<h3 style="
margin:0;
font-size:16px;
color:#003720;
">
Order Summary
</h3>

<p style="
margin-top:8px;
font-size:14px;
color:#666;
">
Order Number:
<strong>#${order.orderNumber}</strong>
</p>

<p style="
margin-top:5px;
font-size:14px;
color:#666;
">
Placed On:
<strong>${new Date(order.createdAt).toLocaleDateString("en-IN")}</strong>
</p>
</td>

<td align="right">
<a
href="https://rehnoorjewels.com/track-order?id=${order.orderNumber}"
style="
background:#003720;
color:#fff;
text-decoration:none;
padding:12px 18px;
border-radius:6px;
display:inline-block;
font-size:13px;
"
>
Track Order
</a>
</td>
</tr>
</table>

</td>
</tr>

<!-- ITEMS -->
<tr>
<td style="padding:0 40px 30px;">

<table width="100%" cellpadding="12" cellspacing="0"
style="
border:1px solid #eee;
border-collapse:collapse;
">

<tr bgcolor="#f8f6f2">
<th align="left">Product</th>
<th align="center">Qty</th>
<th align="right">Price</th>
<th align="right">Total</th>
</tr>

${itemsHtml}

</table>

</td>
</tr>

<!-- PRICE SUMMARY -->
<tr>
<td style="padding:0 40px 30px;">

<table width="100%" cellpadding="8">

<tr>
<td style="color:#666;">Subtotal</td>
<td align="right">
₹${order.pricing.subtotal}
</td>
</tr>

<tr>
<td style="color:#666;">Shipping</td>
<td align="right">
₹${order.pricing.shippingCharge}
</td>
</tr>

<tr>
<td style="color:#666;">Discount</td>
<td align="right" style="color:#d62828;">
-₹${order.pricing.discountAmount}
</td>
</tr>

<tr>
<td colspan="2">
<hr style="border:none;border-top:1px solid #ddd;">
</td>
</tr>

<tr>
<td>
<strong>Total</strong>
</td>
<td align="right">
<strong style="
font-size:20px;
color:#003720;
">
₹${order.pricing.total}
</strong>
</td>
</tr>

</table>

</td>
</tr>

<!-- CUSTOMER DETAILS -->
<tr>
<td style="padding:0 40px 30px;">

<table width="100%" cellpadding="0" cellspacing="0">

<tr>

<td width="48%"
valign="top"
style="
background:#f8f6f2;
padding:20px;
border-radius:10px;
">

<h3 style="
margin-top:0;
font-size:14px;
color:#003720;
">
Customer Details
</h3>

<p style="line-height:26px;color:#555;">
<strong>${order.customerName}</strong><br>
${order.customerEmail}<br>
${order.customerPhone}
</p>

</td>

<td width="4%"></td>

<td width="48%"
valign="top"
style="
background:#f8f6f2;
padding:20px;
border-radius:10px;
">

<h3 style="
margin-top:0;
font-size:14px;
color:#003720;
">
Shipping Address
</h3>

<p style="line-height:26px;color:#555;">

<strong>
${order.shippingAddress?.fullName || ""}
</strong><br>

${order.shippingAddress?.addressLine1 || ""}<br>

${
  order.shippingAddress?.addressLine2
    ? `${order.shippingAddress.addressLine2}<br>`
    : ""
}

${order.shippingAddress?.city || ""},
${order.shippingAddress?.state || ""}

- ${order.shippingAddress?.pincode || ""}<br>

${order.shippingAddress?.country || "India"}

</p>

</td>

</tr>

</table>

</td>
</tr>

<!-- PAYMENT -->
<tr>
<td style="padding:0 40px 30px;">

<table width="100%"
style="
background:#f8f6f2;
padding:20px;
border-radius:10px;
">

<tr>
<td>
Payment Method
</td>
<td align="right">
<strong>
${order.payment?.method.toUpperCase()}
</strong>
</td>
</tr>

<tr>
<td>
Payment Status
</td>
<td align="right">
<strong>
${order.payment?.status || "Pending"}
</strong>
</td>
</tr>

<tr>
<td>
Order Status
</td>
<td align="right">
<strong style="color:#003720;">
${order.status}
</strong>
</td>
</tr>

</table>

</td>
</tr>

<!-- FOOTER -->
<tr>
<td
align="center"
style="
background:#f8f6f2;
padding:35px;
border-top:1px solid #eee;
">

<p style="
font-size:14px;
color:#666;
margin:0;
">
Thank you for choosing
<strong>Rehnoor Jewels</strong>.
</p>

<p style="
margin-top:15px;
font-size:13px;
color:#888;
line-height:24px;
">
If you have any questions regarding your order,
simply reply to this email.
</p>

<p style="
margin-top:20px;
font-size:12px;
color:#aaa;
">
Rehnoor Jewels • New Delhi, India
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;

  const payload = {
    sender: {
      email: process.env.BREVO_SENDER_EMAIL,
      name: process.env.BREVO_SENDER_NAME || "Order Confirmed",
    },

    to: [
      {
        email: order.customerEmail,
        name: order.customerName,
      },
    ],

    // bcc: [
    //   {
    //     email: "hello@rehnoorjewels.com",
    //     name: "Rehnoor Jewels Admin",
    //   },
    // ],

    subject: `Invoice - ${order.orderNumber}`,

    htmlContent,
  };

  console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY);
  console.log("BREVO_SENDER_EMAIL:", process.env.BREVO_SENDER_EMAIL);

  const res = await axios.post(`${BREVO_BASE}/smtp/email`, payload, {
    headers: brevoHeaders(),
  });
  // console.log(res);
};

module.exports = sendInvoiceEmail;
