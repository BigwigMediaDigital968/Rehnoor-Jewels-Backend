const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../model/Order/orderModel");
const toNumericId = require("../../utils/toNumericId"); // Import to convert Mongo IDs to numeric

function generateShiprocketHMAC(rawStringPayload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(rawStringPayload)
    .digest("base64");
}

const generateCheckoutToken = async (req, res) => {
  try {
    const { items, redirectUrl } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: "Cart items are required" });
    }

    const sellerDomain = process.env.SELLER_DOMAIN || "www.rehnoorjewels.com";

    const sanitizedRedirectUrl =
      redirectUrl && !redirectUrl.includes("localhost")
        ? redirectUrl
        : `https://${sellerDomain}/order-success`;

    // 1. Build Payload mapping directly to the numeric IDs exposed in catalog API
    const payloadObject = {
      cart_data: {
        items: items.map((item) => {
          const rawId =
            item.variantId || item.id || item._id || item.variant?._id;

          // If rawId is a 24-char Mongo ObjectId string, convert it using toNumericId
          const numericVariantId =
            typeof rawId === "number" ? rawId : toNumericId(rawId);

          return {
            variant_id: String(numericVariantId),
            quantity: Number(item.quantity || item.qty || 1),
          };
        }),
        domain: sellerDomain,
      },
      redirect_url: sanitizedRedirectUrl,
      timestamp: new Date().toISOString(),
    };

    // 2. Stringify payload once for exact byte-matching HMAC
    const rawPayloadString = JSON.stringify(payloadObject);

    // 3. HMAC SHA256 Signature in Base64
    const hmacSignature = generateShiprocketHMAC(
      rawPayloadString,
      process.env.SHIPROCKET_SECRET_KEY,
    );

    console.log("[Shiprocket Outgoing Payload]:", rawPayloadString);

    // 4. Request Access Token
    const response = await axios.post(
      "https://checkout-api.shiprocket.com/api/v1/access-token/checkout",
      rawPayloadString,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": process.env.SHIPROCKET_API_KEY,
          "X-Api-HMAC-SHA256": hmacSignature,
        },
      },
    );

    return res.status(200).json({
      success: true,
      token: response.data?.result?.token || response.data?.token,
      raw: response.data,
    });
  } catch (error) {
    console.error(
      "[Shiprocket Access Token Error Detail]:",
      error.response?.data || error.message,
    );
    return res.status(500).json({
      error: "Failed to generate checkout access token",
      details: error.response?.data || error.message,
    });
  }
};

const handleOrderWebhook = async (req, res) => {
  try {
    const orderData = req.body;

    if (!orderData || !orderData.order_id) {
      return res
        .status(400)
        .json({ status: "FAILED", message: "Invalid payload" });
    }

    await Order.findOneAndUpdate(
      { shiprocketOrderId: orderData.order_id },
      {
        shiprocketOrderId: orderData.order_id,
        items: orderData.cart_data?.items || [],
        paymentStatus: orderData.status,
        customerPhone: orderData.phone,
        customerEmail: orderData.email,
        paymentType: orderData.payment_type,
        totalAmount: orderData.total_amount_payable,
        rawShiprocketData: orderData,
      },
      { upsert: true, new: true },
    );

    return res
      .status(200)
      .json({ status: "SUCCESS", message: "Order processed" });
  } catch (error) {
    console.error("[Shiprocket Order Webhook Error]:", error);
    return res.status(500).json({ status: "FAILED", error: error.message });
  }
};

module.exports = {
  generateCheckoutToken,
  handleOrderWebhook,
};
