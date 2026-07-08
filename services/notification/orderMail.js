import axios from "axios";

export const sendPaymentCancelMail = async (order) => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Failed</title>
</head>

<body style="margin:0;padding:0;background:#f8f6f2;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f8f6f2">
<tr>
<td align="center" style="padding:30px 15px;">

<table width="600" cellpadding="0" cellspacing="0" border="0"
style="background:#ffffff;border-radius:16px;overflow:hidden;">

<!-- HEADER -->
<tr>
<td align="center" style="background:#003720;padding:40px 30px;">

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
Payment Unsuccessful
</p>

</td>
</tr>

<!-- CONTENT -->
<tr>
<td style="padding:40px;">

<div style="
background:#fff8f0;
border:1px solid #ffe0b2;
border-radius:10px;
padding:24px;
text-align:center;
">

<h2 style="
margin:0;
font-size:18px;
color:#d62828;
">
Payment Could Not Be Completed
</h2>

<p style="
margin:20px 0 10px;
font-size:15px;
line-height:28px;
color:#555;
">
Hello <strong>${order.customerName}</strong>,
</p>

<p style="
font-size:15px;
line-height:28px;
color:#555;
margin:0;
">
We were unable to process the payment for your order.
No worries — your order details have been recorded and you may try placing the order again.
</p>

<p style="
font-size:18px;
font-weight:bold;
color:#003720;
margin:25px 0 10px;
">
Order #${order.orderNumber}
</p>

<p style="
font-size:14px;
color:#666;
">
Amount: <strong>₹${order.pricing.total}</strong>
</p>

</div>

</td>
</tr>

<!-- CTA -->
<tr>
<td align="center" style="padding:0 40px 40px;">

<a
href="https://rehnoorjewels.com"
style="
background:#003720;
color:#ffffff;
text-decoration:none;
padding:14px 30px;
border-radius:8px;
display:inline-block;
font-size:14px;
font-weight:bold;
">
Visit Rehnoor Jewels
</a>

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
<strong>Rehnoor Jewels</strong>
</p>

<p style="
margin-top:15px;
font-size:13px;
color:#888;
line-height:24px;
">
If the amount was deducted from your account, it is usually reversed automatically by your bank within a few business days. For any assistance, please contact our support team.
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

   const res =  await axios.post(
        "https://api.brevo.com/v3/smtp/email",
        {
            sender: {
                email: process.env.BREVO_SENDER_EMAIL,
                name: "Rehnoor Jewels",
            },
            to: [
                {
                    email: order.customerEmail,
                    name: order.customerName,
                },
            ],
            subject: `Payment Failed for Order #${order.orderNumber}`,
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


    console.log(res)
};