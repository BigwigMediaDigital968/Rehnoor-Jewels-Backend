const crypto = require("crypto");
const axios = require("axios");

// Generate HMAC SHA256 in Base64
function generateHmac(bodyString, secretKey) {
  return crypto
    .createHmac("sha256", secretKey)
    .update(bodyString)
    .digest("base64");
}

const generateCheckoutToken = async (req, res) => {
  try {
    const { items, redirectUrl } = req.body;

    const apiKey = process.env.SHIPROCKET_CHECKOUT_API_KEY;
    const secretKey = process.env.SHIPROCKET_CHECKOUT_SECRET_KEY;

    const payload = {
      cart_data: {
        items: items.map((item) => ({
          variant_id: item.variantId.toString(),
          quantity: item.quantity,
        })),
      },
      redirect_url: redirectUrl || "https://rehnoorjewels.com/thankyou",
      timestamp: new Date().toISOString(),
    };

    const payloadString = JSON.stringify(payload);
    const hmacSignature = generateHmac(payloadString, secretKey);

    const response = await axios.post(
      "https://checkout-api.shiprocket.com/api/v1/access-token/checkout",
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          "X-Api-HMAC-SHA256": hmacSignature,
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("[Shiprocket Token Error]:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Failed to generate Shiprocket checkout token",
      details: error.response?.data || error.message,
    });
  }
};

module.exports = { generateCheckoutToken };