require("dotenv").config();
const client = require("./services/mail/twilio"); // Adjust path if needed

async function test() {
  try {
    console.log("Testing WhatsApp dispatch...");
    const wa = await client.messages.create({
      contentSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        1: "Test Customer",
        2: "1001",
        3: "500",
        4: "1001",
      }),
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: "whatsapp:+9191880244457", // Put your real mobile number here
    });
    console.log("WhatsApp Success! SID:", wa.sid);
  } catch (err) {
    console.error("WhatsApp Failed:", err.message, err.code);
  }
}

test();