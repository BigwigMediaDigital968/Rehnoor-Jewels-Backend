// const axios = require("axios");
// const crypto = require("crypto");
// const Order = require("../../model/Order/orderModel");
// const toNumericId = require("../../utils/toNumericId"); // Import to convert Mongo IDs to numeric

// function generateShiprocketHMAC(rawStringPayload, secret) {
//   return crypto
//     .createHmac("sha256", secret)
//     .update(rawStringPayload)
//     .digest("base64");
// }

// const generateCheckoutToken = async (req, res) => {
//   try {
//     const { items, redirectUrl } = req.body;

//     if (!items || !items.length) {
//       return res.status(400).json({ error: "Cart items are required" });
//     }

//     const sellerDomain = process.env.SELLER_DOMAIN || "www.rehnoorjewels.com";

//     const sanitizedRedirectUrl =
//       redirectUrl && !redirectUrl.includes("localhost")
//         ? redirectUrl
//         : `https://${sellerDomain}/order-success`;

//     // 1. Build Payload mapping directly to the numeric IDs exposed in catalog API
//     const payloadObject = {
//       cart_data: {
//         items: items.map((item) => {
//           const rawId =
//             item.variantId || item.id || item._id || item.variant?._id;

//           // If rawId is a 24-char Mongo ObjectId string, convert it using toNumericId
//           const numericVariantId =
//             typeof rawId === "number" ? rawId : toNumericId(rawId);

//           return {
//             variant_id: String(numericVariantId),
//             quantity: Number(item.quantity || item.qty || 1),
//           };
//         }),
//         domain: sellerDomain,
//       },
//       redirect_url: sanitizedRedirectUrl,
//       timestamp: new Date().toISOString(),
//     };

//     // 2. Stringify payload once for exact byte-matching HMAC
//     const rawPayloadString = JSON.stringify(payloadObject);

//     // 3. HMAC SHA256 Signature in Base64
//     const hmacSignature = generateShiprocketHMAC(
//       rawPayloadString,
//       process.env.SHIPROCKET_SECRET_KEY,
//     );

//     console.log("[Shiprocket Outgoing Payload]:", rawPayloadString);

//     // 4. Request Access Token
//     const response = await axios.post(
//       "https://checkout-api.shiprocket.com/api/v1/access-token/checkout",
//       rawPayloadString,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "X-Api-Key": process.env.SHIPROCKET_API_KEY,
//           "X-Api-HMAC-SHA256": hmacSignature,
//         },
//       },
//     );

//     return res.status(200).json({
//       success: true,
//       token: response.data?.result?.token || response.data?.token,
//       raw: response.data,
//     });
//   } catch (error) {
//     console.error(
//       "[Shiprocket Access Token Error Detail]:",
//       error.response?.data || error.message,
//     );
//     return res.status(500).json({
//       error: "Failed to generate checkout access token",
//       details: error.response?.data || error.message,
//     });
//   }
// };

// const handleOrderWebhook = async (req, res) => {
//   try {
//     const orderData = req.body;

//     if (!orderData || !orderData.order_id) {
//       return res
//         .status(400)
//         .json({ status: "FAILED", message: "Invalid payload" });
//     }

//     await Order.findOneAndUpdate(
//       { shiprocketOrderId: orderData.order_id },
//       {
//         shiprocketOrderId: orderData.order_id,
//         items: orderData.cart_data?.items || [],
//         paymentStatus: orderData.status,
//         customerPhone: orderData.phone,
//         customerEmail: orderData.email,
//         paymentType: orderData.payment_type,
//         totalAmount: orderData.total_amount_payable,
//         rawShiprocketData: orderData,
//       },
//       { upsert: true, new: true },
//     );

//     return res
//       .status(200)
//       .json({ status: "SUCCESS", message: "Order processed" });
//   } catch (error) {
//     console.error("[Shiprocket Order Webhook Error]:", error);
//     return res.status(500).json({ status: "FAILED", error: error.message });
//   }
// };

// module.exports = {
//   generateCheckoutToken,
//   handleOrderWebhook,
// };

const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../model/Order/orderModel");
const Product = require("../../model/products/productModel");
const toNumericId = require("../../utils/toNumericId");

function generateShiprocketHMAC(rawStringPayload, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(rawStringPayload)
    .digest("base64");
}

// 1. Generate Access Token
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

    const payloadObject = {
      cart_data: {
        items: items.map((item) => {
          const rawId =
            item.variantId || item.id || item._id || item.variant?._id;

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

    const rawPayloadString = JSON.stringify(payloadObject);

    const hmacSignature = generateShiprocketHMAC(
      rawPayloadString,
      process.env.SHIPROCKET_SECRET_KEY,
    );

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

// 2. Webhook: Receive Order Creation & Sync to Shiprocket Engage
const handleOrderWebhook = async (req, res) => {
  try {
    const orderData = req.body;

    if (!orderData || !orderData.order_id) {
      return res
        .status(400)
        .json({ status: "FAILED", message: "Invalid payload" });
    }

    // Save to Database
    const savedOrder = await Order.findOneAndUpdate(
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

    // Build Shiprocket Engage Order Webhook Payload
    const srCompanyId = Number(process.env.SHIPROCKET_COMPANY_ID || 1666579);
    const orderDate = new Date().toISOString();

    const lineItems = (orderData.cart_data?.items || []).map((item) => ({
      sku: item.sku || "N/A",
      name: item.name || item.title || "Product",
      line_item_id: String(item.id || item.variant_id || "1"),
      variant_id: String(item.variant_id || ""),
      product_id: String(item.product_id || ""),
      price: Number(item.price || 0),
      quantity: String(item.quantity || 1),
      product_discount: Number(item.discount || 0),
      tax_amount: Number(item.tax_amount || 0),
      tax_rate: Number(item.tax_rate || 0),
      fulfillment_status: orderData.fulfillment_status || "",
      categories: "",
      type: "",
    }));

    const engageOrderPayload = {
      sr_company_id: srCompanyId,
      orderId: String(orderData.order_id),
      order_number: String(orderData.order_number || orderData.order_id),
      customer_id: String(orderData.customer_id || "0"),
      phone: String(orderData.phone || "").replace(/^\+?91/, ""), // Without country code
      fullName:
        `${orderData.first_name || ""} ${orderData.last_name || ""}`.trim() ||
        orderData.fullName ||
        "Customer",
      email: orderData.email || "",
      total_price: Number(
        orderData.total_amount_payable || orderData.total_price || 0,
      ),
      total_line_items_price: Number(
        orderData.total_line_items_price || orderData.total_amount_payable || 0,
      ),
      cart_token: orderData.cart_token || "",
      checkout_token: orderData.checkout_token || "",
      ga_transaction_id: "",
      created_at: orderData.created_at || orderDate,
      updated_at: orderData.updated_at || orderDate,
      shipping_cost: Number(orderData.shipping_cost || 0),
      total_discounts: Number(orderData.total_discounts || 0),
      city: orderData.city || orderData.shipping_address?.city || "",
      state: orderData.state || orderData.shipping_address?.state || "",
      country:
        orderData.country || orderData.shipping_address?.country || "India",
      zip: String(orderData.zip || orderData.shipping_address?.pincode || ""),
      payment_mode: orderData.payment_mode || "Prepaid",
      taxes_included: true,
      total_tax: Number(orderData.total_tax || 0),
      order_mode: "Online",
      coupons: orderData.coupons || [],
      line_items: lineItems,
      userId: String(orderData.userId || ""),
      source: "web",
      payment_method: String(orderData.payment_type || "cod").toLowerCase(),
      address_line1:
        orderData.address_line1 || orderData.shipping_address?.address1 || "",
      address_line2:
        orderData.address_line2 || orderData.shipping_address?.address2 || "",
      financial_status: orderData.financial_status || "Paid",
      fulfillment_status: "",
      categories: "",
      type: "",
      is_active: true,
      brand_name: "Rehnoor Jewels",
    };

    // Forward to Shiprocket Engage Webhook
    try {
      await axios.post(
        "https://sr-engage-webhook.shiprocket.in/order/create",
        engageOrderPayload,
        { headers: { "Content-Type": "application/json" } },
      );
      console.log("[Shiprocket Engage] Order synced successfully");
    } catch (engageErr) {
      console.error(
        "[Shiprocket Engage Order Sync Error]:",
        engageErr.response?.data || engageErr.message,
      );
    }

    return res
      .status(200)
      .json({
        status: "SUCCESS",
        message: "Order processed",
        data: savedOrder,
      });
  } catch (error) {
    console.error("[Shiprocket Order Webhook Error]:", error);
    return res.status(500).json({ status: "FAILED", error: error.message });
  }
};

// 3. Webhook: Track Abandoned Checkout
const handleAbandonedCheckoutWebhook = async (req, res) => {
  try {
    const checkoutData = req.body;

    if (!checkoutData || !checkoutData.c_id) {
      return res
        .status(400)
        .json({ error: "Missing required checkout identifier (c_id)" });
    }

    const srCompanyId = Number(process.env.SHIPROCKET_COMPANY_ID || 1234);

    const formattedItems = (checkoutData.items || []).map((item) => ({
      id: Number(item.id || item.variant_id || 0),
      sku: item.sku || "",
      url: item.url || "",
      grams: Number(item.grams || 0),
      image: item.image || "",
      price: Number(item.price || 0),
      title: item.title || item.name || "",
      taxable: Boolean(item.taxable),
      quantity: Number(item.quantity || 1),
      discounts: item.discounts || [],
      gift_card: false,
      line_price: Number(item.line_price || item.price * (item.quantity || 1)),
      product_id: Number(item.product_id || 0),
      properties: item.properties || {},
      variant_id: Number(item.variant_id || 0),
      final_price: Number(item.final_price || item.price || 0),
      product_type: item.product_type || "",
      product_title: item.product_title || item.title || "",
      original_price: Number(item.original_price || item.price || 0),
      total_discount: Number(item.total_discount || 0),
      final_line_price: Number(
        item.final_line_price || item.price * (item.quantity || 1),
      ),
      requires_shipping: true,
      options_with_values: item.options_with_values || [],
      properties_stringified: JSON.stringify(item.properties || {}),
      line_level_discount_allocations: [],
    }));

    const abandonPayload = {
      sr_company_id: srCompanyId,
      c_id: String(checkoutData.c_id),
      abc_url: checkoutData.abc_url || "",
      token: checkoutData.token || "",
      original_total_price: String(
        checkoutData.original_total_price || "0.0000",
      ),
      total_price: String(checkoutData.total_price || "0.0000"),
      total_discount: String(checkoutData.total_discount || "0.0000"),
      total_weight: String(checkoutData.total_weight || "0.0000"),
      is_abandoned: true,
      item_count: Number(checkoutData.item_count || formattedItems.length),
      customer: {
        email: checkoutData.customer?.email || "",
        phone: checkoutData.customer?.phone || "",
        firstname: checkoutData.customer?.firstname || "",
        lastname: checkoutData.customer?.lastname || "",
        customer_id: Number(checkoutData.customer?.customer_id || 0),
      },
      items: formattedItems,
    };

    // Forward to Shiprocket Engage Abandoned Checkout Endpoint
    const response = await axios.post(
      "https://sr-engage-webhook.shiprocket.in/abandonedcheckout/create",
      abandonPayload,
      { headers: { "Content-Type": "application/json" } },
    );

    return res.status(200).json({
      status: 200,
      message: "abandoned checkout order enqueued",
      data: response.data,
    });
  } catch (error) {
    console.error(
      "[Shiprocket Abandoned Checkout Error]:",
      error.response?.data || error.message,
    );
    return res
      .status(500)
      .json({
        error: "Failed to sync abandoned checkout",
        details: error.message,
      });
  }
};

module.exports = {
  generateCheckoutToken,
  handleOrderWebhook,
  handleAbandonedCheckoutWebhook,
};
