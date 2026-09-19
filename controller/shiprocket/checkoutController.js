// const axios = require("axios");
// const crypto = require("crypto");
// const Order = require("../../model/Order/orderModel");
// const Product = require("../../model/products/productModel");
// const toNumericId = require("../../utils/toNumericId");

// // Import Notification Services
// const sendInvoiceEmail = require("../../services/mail/sendInvoiceEmail");
// const sendSMSOrderConfirmation = require("../../services/notification/sendSMS");
// const sendAdminOrderNotification = require("../../services/mail/sendAdminOrderNotification");
// const sendWhatsappOrderConfirmation = require("../../services/notification/sendWhatsapp.js");

// function generateShiprocketHMAC(rawStringPayload, secret) {
//   return crypto
//     .createHmac("sha256", secret)
//     .update(rawStringPayload)
//     .digest("base64");
// }

// // 1. Generate Access Token
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

//     const payloadObject = {
//       cart_data: {
//         items: items.map((item) => {
//           const rawId =
//             item.variantId || item.id || item._id || item.variant?._id;

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

//     const rawPayloadString = JSON.stringify(payloadObject);

//     const hmacSignature = generateShiprocketHMAC(
//       rawPayloadString,
//       process.env.SHIPROCKET_SECRET_KEY,
//     );

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

// function transformShiprocketOrderToNotificationFormat(orderData, savedOrder) {
//   const firstName =
//     orderData.first_name || orderData.shipping_address?.first_name || "";
//   const lastName =
//     orderData.last_name || orderData.shipping_address?.last_name || "";
//   const fullName =
//     `${firstName} ${lastName}`.trim() ||
//     orderData.fullName ||
//     "Valued Customer";

//   const rawPhone = String(
//     orderData.phone || orderData.shipping_address?.phone || "",
//   ).replace(/^\+?91/, "");

//   const items = (orderData.cart_data?.items || orderData.line_items || []).map(
//     (item) => ({
//       name: item.name || item.title || "Product",
//       sku: item.sku || "",
//       slug: item.slug || "",
//       image:
//         item.image || item.src || "https://rehnoorjewels.com/placeholder.jpg",
//       quantity: Number(item.quantity || item.qty || 1),
//       unitPrice: Number(item.price || item.unit_price || 0),
//       lineTotal: Number(item.price || 0) * Number(item.quantity || 1),
//     }),
//   );

//   const subtotal = Number(
//     orderData.total_line_items_price || orderData.sub_total || 0,
//   );
//   const shippingCharge = Number(
//     orderData.shipping_cost || orderData.shipping_charges || 0,
//   );
//   const discountAmount = Number(
//     orderData.total_discounts || orderData.discount || 0,
//   );
//   const total = Number(
//     orderData.total_amount_payable || orderData.total_price || 0,
//   );

//   return {
//     orderNumber: String(orderData.order_number || orderData.order_id),
//     customerName: fullName,
//     customerEmail: orderData.email || orderData.customer?.email || "",
//     customerPhone: rawPhone,
//     createdAt: orderData.created_at || new Date(),
//     status: orderData.status || "Confirmed",
//     items,
//     pricing: {
//       subtotal,
//       shippingCharge,
//       discountAmount,
//       total,
//     },
//     payment: {
//       method: String(
//         orderData.payment_type || orderData.payment_mode || "Prepaid",
//       ).toUpperCase(),
//       status: orderData.financial_status || orderData.status || "Paid",
//     },
//     shippingAddress: {
//       fullName,
//       addressLine1:
//         orderData.address_line1 || orderData.shipping_address?.address1 || "",
//       addressLine2:
//         orderData.address_line2 || orderData.shipping_address?.address2 || "",
//       city: orderData.city || orderData.shipping_address?.city || "",
//       state: orderData.state || orderData.shipping_address?.state || "",
//       pincode: orderData.zip || orderData.shipping_address?.pincode || "",
//       country:
//         orderData.country || orderData.shipping_address?.country || "India",
//     },
//   };
// }

// // 2. Webhook: Receive Order Creation & Sync to Shiprocket Engage
// // const handleOrderWebhook = async (req, res) => {
// //   try {
// //     const orderData = req.body;

// //     if (!orderData || !orderData.order_id) {
// //       return res
// //         .status(400)
// //         .json({ status: "FAILED", message: "Invalid payload" });
// //     }

// //     // Save to Database
// //     const savedOrder = await Order.findOneAndUpdate(
// //       { shiprocketOrderId: orderData.order_id },
// //       {
// //         shiprocketOrderId: orderData.order_id,
// //         items: orderData.cart_data?.items || [],
// //         paymentStatus: orderData.status,
// //         customerPhone: orderData.phone,
// //         customerEmail: orderData.email,
// //         paymentType: orderData.payment_type,
// //         totalAmount: orderData.total_amount_payable,
// //         rawShiprocketData: orderData,
// //       },
// //       { upsert: true, new: true },
// //     );

// //     // Build Shiprocket Engage Order Webhook Payload
// //     const srCompanyId = Number(process.env.SHIPROCKET_COMPANY_ID || 1666579);
// //     const orderDate = new Date().toISOString();

// //     const lineItems = (orderData.cart_data?.items || []).map((item) => ({
// //       sku: item.sku || "N/A",
// //       name: item.name || item.title || "Product",
// //       line_item_id: String(item.id || item.variant_id || "1"),
// //       variant_id: String(item.variant_id || ""),
// //       product_id: String(item.product_id || ""),
// //       price: Number(item.price || 0),
// //       quantity: String(item.quantity || 1),
// //       product_discount: Number(item.discount || 0),
// //       tax_amount: Number(item.tax_amount || 0),
// //       tax_rate: Number(item.tax_rate || 0),
// //       fulfillment_status: orderData.fulfillment_status || "",
// //       categories: "",
// //       type: "",
// //     }));

// //     const engageOrderPayload = {
// //       sr_company_id: srCompanyId,
// //       orderId: String(orderData.order_id),
// //       order_number: String(orderData.order_number || orderData.order_id),
// //       customer_id: String(orderData.customer_id || "0"),
// //       phone: String(orderData.phone || "").replace(/^\+?91/, ""), // Without country code
// //       fullName:
// //         `${orderData.first_name || ""} ${orderData.last_name || ""}`.trim() ||
// //         orderData.fullName ||
// //         "Customer",
// //       email: orderData.email || "",
// //       total_price: Number(
// //         orderData.total_amount_payable || orderData.total_price || 0,
// //       ),
// //       total_line_items_price: Number(
// //         orderData.total_line_items_price || orderData.total_amount_payable || 0,
// //       ),
// //       cart_token: orderData.cart_token || "",
// //       checkout_token: orderData.checkout_token || "",
// //       ga_transaction_id: "",
// //       created_at: orderData.created_at || orderDate,
// //       updated_at: orderData.updated_at || orderDate,
// //       shipping_cost: Number(orderData.shipping_cost || 0),
// //       total_discounts: Number(orderData.total_discounts || 0),
// //       city: orderData.city || orderData.shipping_address?.city || "",
// //       state: orderData.state || orderData.shipping_address?.state || "",
// //       country:
// //         orderData.country || orderData.shipping_address?.country || "India",
// //       zip: String(orderData.zip || orderData.shipping_address?.pincode || ""),
// //       payment_mode: orderData.payment_mode || "Prepaid",
// //       taxes_included: true,
// //       total_tax: Number(orderData.total_tax || 0),
// //       order_mode: "Online",
// //       coupons: orderData.coupons || [],
// //       line_items: lineItems,
// //       userId: String(orderData.userId || ""),
// //       source: "web",
// //       payment_method: String(orderData.payment_type || "cod").toLowerCase(),
// //       address_line1:
// //         orderData.address_line1 || orderData.shipping_address?.address1 || "",
// //       address_line2:
// //         orderData.address_line2 || orderData.shipping_address?.address2 || "",
// //       financial_status: orderData.financial_status || "Paid",
// //       fulfillment_status: "",
// //       categories: "",
// //       type: "",
// //       is_active: true,
// //       brand_name: "Rehnoor Jewels",
// //     };

// //     // Forward to Shiprocket Engage Webhook
// //     try {
// //       await axios.post(
// //         "https://sr-engage-webhook.shiprocket.in/order/create",
// //         engageOrderPayload,
// //         { headers: { "Content-Type": "application/json" } },
// //       );
// //       console.log("[Shiprocket Engage] Order synced successfully");
// //     } catch (engageErr) {
// //       console.error(
// //         "[Shiprocket Engage Order Sync Error]:",
// //         engageErr.response?.data || engageErr.message,
// //       );
// //     }

// //     return res.status(200).json({
// //       status: "SUCCESS",
// //       message: "Order processed",
// //       data: savedOrder,
// //     });
// //   } catch (error) {
// //     console.error("[Shiprocket Order Webhook Error]:", error);
// //     return res.status(500).json({ status: "FAILED", error: error.message });
// //   }
// // };

// const handleOrderWebhook = async (req, res) => {
//   try {
//     const orderData = req.body;

//     if (!orderData || !orderData.order_id) {
//       return res
//         .status(400)
//         .json({ status: "FAILED", message: "Invalid payload" });
//     }

//     // 1. Save / Update Order in Database
//     const savedOrder = await Order.findOneAndUpdate(
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

//     // 2. Build Shiprocket Engage Order Webhook Payload & Sync
//     const srCompanyId = Number(process.env.SHIPROCKET_COMPANY_ID || 1666579);
//     const orderDate = new Date().toISOString();

//     const lineItems = (orderData.cart_data?.items || []).map((item) => ({
//       sku: item.sku || "N/A",
//       name: item.name || item.title || "Product",
//       line_item_id: String(item.id || item.variant_id || "1"),
//       variant_id: String(item.variant_id || ""),
//       product_id: String(item.product_id || ""),
//       price: Number(item.price || 0),
//       quantity: String(item.quantity || 1),
//       product_discount: Number(item.discount || 0),
//       tax_amount: Number(item.tax_amount || 0),
//       tax_rate: Number(item.tax_rate || 0),
//       fulfillment_status: orderData.fulfillment_status || "",
//       categories: "",
//       type: "",
//     }));

//     const engageOrderPayload = {
//       sr_company_id: srCompanyId,
//       orderId: String(orderData.order_id),
//       order_number: String(orderData.order_number || orderData.order_id),
//       customer_id: String(orderData.customer_id || "0"),
//       phone: String(orderData.phone || "").replace(/^\+?91/, ""),
//       fullName:
//         `${orderData.first_name || ""} ${orderData.last_name || ""}`.trim() ||
//         orderData.fullName ||
//         "Customer",
//       email: orderData.email || "",
//       total_price: Number(
//         orderData.total_amount_payable || orderData.total_price || 0,
//       ),
//       total_line_items_price: Number(
//         orderData.total_line_items_price || orderData.total_amount_payable || 0,
//       ),
//       cart_token: orderData.cart_token || "",
//       checkout_token: orderData.checkout_token || "",
//       ga_transaction_id: "",
//       created_at: orderData.created_at || orderDate,
//       updated_at: orderData.updated_at || orderDate,
//       shipping_cost: Number(orderData.shipping_cost || 0),
//       total_discounts: Number(orderData.total_discounts || 0),
//       city: orderData.city || orderData.shipping_address?.city || "",
//       state: orderData.state || orderData.shipping_address?.state || "",
//       country:
//         orderData.country || orderData.shipping_address?.country || "India",
//       zip: String(orderData.zip || orderData.shipping_address?.pincode || ""),
//       payment_mode: orderData.payment_mode || "Prepaid",
//       taxes_included: true,
//       total_tax: Number(orderData.total_tax || 0),
//       order_mode: "Online",
//       coupons: orderData.coupons || [],
//       line_items: lineItems,
//       userId: String(orderData.userId || ""),
//       source: "web",
//       payment_method: String(orderData.payment_type || "cod").toLowerCase(),
//       address_line1:
//         orderData.address_line1 || orderData.shipping_address?.address1 || "",
//       address_line2:
//         orderData.address_line2 || orderData.shipping_address?.address2 || "",
//       financial_status: orderData.financial_status || "Paid",
//       fulfillment_status: "",
//       categories: "",
//       type: "",
//       is_active: true,
//       brand_name: "Rehnoor Jewels",
//     };

//     try {
//       await axios.post(
//         "https://sr-engage-webhook.shiprocket.in/order/create",
//         engageOrderPayload,
//         { headers: { "Content-Type": "application/json" } },
//       );
//       console.log("[Shiprocket Engage] Order synced successfully");
//     } catch (engageErr) {
//       console.error(
//         "[Shiprocket Engage Order Sync Error]:",
//         engageErr.response?.data || engageErr.message,
//       );
//     }

//     // 3. Format Normalized Order Object for Notifications
//     const notificationOrderPayload =
//       transformShiprocketOrderToNotificationFormat(orderData, savedOrder);

//     // 4. Dispatch Notifications Asynchronously
//     const notificationResults = await Promise.allSettled([
//       // A. Customer Invoice Email (Brevo)
//       notificationOrderPayload.customerEmail
//         ? sendInvoiceEmail(notificationOrderPayload)
//         : Promise.resolve("Skipped: No email address"),

//       // B. Admin Notification Email (Brevo)
//       sendAdminOrderNotification(notificationOrderPayload),

//       // C. Customer SMS Notification (Twilio)
//       notificationOrderPayload.customerPhone
//         ? sendSMSOrderConfirmation(notificationOrderPayload)
//         : Promise.resolve("Skipped: No phone number"),

//       // D. Customer & Admin WhatsApp Notification (Twilio)
//       notificationOrderPayload.customerPhone
//         ? sendWhatsappOrderConfirmation(notificationOrderPayload)
//         : Promise.resolve("Skipped: No phone number"),
//     ]);

//     notificationResults.forEach((result, idx) => {
//       const labels = ["Email", "Admin Email", "SMS", "WhatsApp"];
//       if (result.status === "rejected") {
//         console.error(
//           `[Notification Error - ${labels[idx]}]:`,
//           result.reason?.message || result.reason,
//         );
//       } else {
//         console.log(`[Notification Success - ${labels[idx]}]`);
//       }
//     });

//     return res.status(200).json({
//       status: "SUCCESS",
//       message: "Order processed and notifications dispatched",
//       data: savedOrder,
//     });
//   } catch (error) {
//     console.error("[Shiprocket Order Webhook Error]:", error);
//     return res.status(500).json({ status: "FAILED", error: error.message });
//   }
// };

// // 3. Webhook: Track Abandoned Checkout
// const handleAbandonedCheckoutWebhook = async (req, res) => {
//   try {
//     const checkoutData = req.body;

//     if (!checkoutData || !checkoutData.c_id) {
//       return res
//         .status(400)
//         .json({ error: "Missing required checkout identifier (c_id)" });
//     }

//     const srCompanyId = Number(process.env.SHIPROCKET_COMPANY_ID || 1234);

//     const formattedItems = (checkoutData.items || []).map((item) => ({
//       id: Number(item.id || item.variant_id || 0),
//       sku: item.sku || "",
//       url: item.url || "",
//       grams: Number(item.grams || 0),
//       image: item.image || "",
//       price: Number(item.price || 0),
//       title: item.title || item.name || "",
//       taxable: Boolean(item.taxable),
//       quantity: Number(item.quantity || 1),
//       discounts: item.discounts || [],
//       gift_card: false,
//       line_price: Number(item.line_price || item.price * (item.quantity || 1)),
//       product_id: Number(item.product_id || 0),
//       properties: item.properties || {},
//       variant_id: Number(item.variant_id || 0),
//       final_price: Number(item.final_price || item.price || 0),
//       product_type: item.product_type || "",
//       product_title: item.product_title || item.title || "",
//       original_price: Number(item.original_price || item.price || 0),
//       total_discount: Number(item.total_discount || 0),
//       final_line_price: Number(
//         item.final_line_price || item.price * (item.quantity || 1),
//       ),
//       requires_shipping: true,
//       options_with_values: item.options_with_values || [],
//       properties_stringified: JSON.stringify(item.properties || {}),
//       line_level_discount_allocations: [],
//     }));

//     const abandonPayload = {
//       sr_company_id: srCompanyId,
//       c_id: String(checkoutData.c_id),
//       abc_url: checkoutData.abc_url || "",
//       token: checkoutData.token || "",
//       original_total_price: String(
//         checkoutData.original_total_price || "0.0000",
//       ),
//       total_price: String(checkoutData.total_price || "0.0000"),
//       total_discount: String(checkoutData.total_discount || "0.0000"),
//       total_weight: String(checkoutData.total_weight || "0.0000"),
//       is_abandoned: true,
//       item_count: Number(checkoutData.item_count || formattedItems.length),
//       customer: {
//         email: checkoutData.customer?.email || "",
//         phone: checkoutData.customer?.phone || "",
//         firstname: checkoutData.customer?.firstname || "",
//         lastname: checkoutData.customer?.lastname || "",
//         customer_id: Number(checkoutData.customer?.customer_id || 0),
//       },
//       items: formattedItems,
//     };

//     // Forward to Shiprocket Engage Abandoned Checkout Endpoint
//     const response = await axios.post(
//       "https://sr-engage-webhook.shiprocket.in/abandonedcheckout/create",
//       abandonPayload,
//       { headers: { "Content-Type": "application/json" } },
//     );

//     return res.status(200).json({
//       status: 200,
//       message: "abandoned checkout order enqueued",
//       data: response.data,
//     });
//   } catch (error) {
//     console.error(
//       "[Shiprocket Abandoned Checkout Error]:",
//       error.response?.data || error.message,
//     );
//     return res.status(500).json({
//       error: "Failed to sync abandoned checkout",
//       details: error.message,
//     });
//   }
// };

// module.exports = {
//   generateCheckoutToken,
//   handleOrderWebhook,
//   handleAbandonedCheckoutWebhook,
// };

const axios = require("axios");
const crypto = require("crypto");
const Order = require("../../model/Order/orderModel");
const Product = require("../../model/products/productModel");
const toNumericId = require("../../utils/toNumericId");

const dispatchOrderNotifications = require("../../services/notification/dispatchOrderNotifications");

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

    // Fail loudly instead of throwing an opaque "key argument must be of type
    // string" from createHmac further down.
    const missingEnv = [
      "SHIPROCKET_API_KEY",
      "SHIPROCKET_SECRET_KEY",
    ].filter((key) => !process.env[key]);

    if (missingEnv.length) {
      console.error(
        `[Shiprocket Access Token] Missing env vars: ${missingEnv.join(", ")}`,
      );
      return res.status(500).json({
        error: "Shiprocket checkout is not configured",
        details: `Missing environment variables: ${missingEnv.join(", ")}`,
      });
    }

    const sellerDomain = process.env.SELLER_DOMAIN || "www.rehnoorjewels.com";

    const sanitizedRedirectUrl =
      redirectUrl && !redirectUrl.includes("localhost")
        ? redirectUrl
        : `https://${sellerDomain}/thankyou`;

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

// The live "Order Placed" webhook omits `state` but always carries a PIN.
// `state` is required on AddressSchema, so without this the order cannot be
// persisted at all. Coarse first-two-digit postal-zone mapping — good enough
// for records and invoice display, and Shiprocket does the actual shipping.
const PIN_ZONE_TO_STATE = {
  11: "Delhi",
  12: "Haryana",
  13: "Haryana",
  14: "Punjab",
  15: "Punjab",
  16: "Chandigarh",
  17: "Himachal Pradesh",
  18: "Jammu & Kashmir",
  19: "Jammu & Kashmir",
  20: "Uttar Pradesh",
  21: "Uttar Pradesh",
  22: "Uttar Pradesh",
  23: "Uttar Pradesh",
  24: "Uttar Pradesh",
  25: "Uttar Pradesh",
  26: "Uttar Pradesh",
  27: "Uttar Pradesh",
  28: "Uttar Pradesh",
  30: "Rajasthan",
  31: "Rajasthan",
  32: "Rajasthan",
  33: "Rajasthan",
  34: "Rajasthan",
  36: "Gujarat",
  37: "Gujarat",
  38: "Gujarat",
  39: "Gujarat",
  40: "Maharashtra",
  41: "Maharashtra",
  42: "Maharashtra",
  43: "Maharashtra",
  44: "Maharashtra",
  45: "Madhya Pradesh",
  46: "Madhya Pradesh",
  47: "Madhya Pradesh",
  48: "Madhya Pradesh",
  49: "Chhattisgarh",
  50: "Telangana",
  51: "Andhra Pradesh",
  52: "Andhra Pradesh",
  53: "Andhra Pradesh",
  56: "Karnataka",
  57: "Karnataka",
  58: "Karnataka",
  59: "Karnataka",
  60: "Tamil Nadu",
  61: "Tamil Nadu",
  62: "Tamil Nadu",
  63: "Tamil Nadu",
  64: "Tamil Nadu",
  67: "Kerala",
  68: "Kerala",
  69: "Kerala",
  70: "West Bengal",
  71: "West Bengal",
  72: "West Bengal",
  73: "West Bengal",
  74: "West Bengal",
  75: "Odisha",
  76: "Odisha",
  77: "Odisha",
  78: "Assam",
  79: "North East",
  80: "Bihar",
  81: "Jharkhand",
  82: "Jharkhand",
  83: "Jharkhand",
  84: "Bihar",
  85: "Bihar",
};

function deriveStateFromPincode(pincode) {
  const digits = String(pincode || "").replace(/\D/g, "");
  if (digits.length !== 6) return "";
  return PIN_ZONE_TO_STATE[digits.slice(0, 2)] || "";
}

function transformShiprocketOrderToNotificationFormat(orderData, savedOrder) {
  const firstName =
    orderData.first_name ||
    orderData.shipping_address?.first_name ||
    orderData.billing_address?.first_name ||
    "";
  const lastName =
    orderData.last_name ||
    orderData.shipping_address?.last_name ||
    orderData.billing_address?.last_name ||
    "";

  const fullName =
    `${firstName} ${lastName}`.trim() ||
    orderData.fullName ||
    orderData.shipping_address?.name ||
    "Valued Customer";

  let rawPhone =
    orderData.phone ||
    orderData.shipping_address?.phone ||
    orderData.billing_address?.phone ||
    orderData.customer?.phone ||
    "";

  let formattedPhone = String(rawPhone).replace(/\D/g, "");

  if (formattedPhone.length === 10) {
    formattedPhone = `+91${formattedPhone}`;
  } else if (formattedPhone.length > 10 && formattedPhone.startsWith("91")) {
    formattedPhone = `+${formattedPhone}`;
  } else if (formattedPhone.length > 0 && !formattedPhone.startsWith("+")) {
    formattedPhone = `+${formattedPhone}`;
  } else {
    formattedPhone = ""; // Keep empty string if no phone provided
  }

  // FIX 2: Safe Email Extraction
  const customerEmail =
    orderData.email ||
    orderData.customer?.email ||
    orderData.shipping_address?.email ||
    orderData.billing_address?.email ||
    "";

  // FIX 3: Safe Items Array Fallbacks
  const rawItems =
    orderData.cart_data?.items ||
    orderData.line_items ||
    orderData.products ||
    orderData.items ||
    [];

  const items = rawItems.map((item) => {
    const unitPrice = Number(item.price || item.unit_price || 0);
    const quantity = Number(item.quantity || item.qty || 1);
    return {
      name: item.name || item.title || "Product",
      sku: item.sku || "",
      slug: item.slug || "",
      image:
        item.image || item.src || "https://rehnoorjewels.com/placeholder.jpg",
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });

  const itemsTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

  // The live webhook sends `total_price` (line-items total, exclusive of
  // shipping), `shipping_price` and `total_discount`. The documented payload
  // sends `total_amount_payable` (grand total) instead. Support both.
  const subtotal = Number(
    orderData.total_line_items_price ||
      orderData.sub_total ||
      orderData.total_price ||
      itemsTotal ||
      0,
  );
  const shippingCharge = Number(
    orderData.shipping_cost ||
      orderData.shipping_charges ||
      orderData.shipping_price ||
      0,
  );
  const discountAmount = Number(
    orderData.total_discounts ||
      orderData.discount ||
      orderData.total_discount ||
      0,
  );
  const total = Number(
    orderData.total_amount_payable ||
      subtotal + shippingCharge - discountAmount ||
      0,
  );

  const pincode = String(
    orderData.zip ||
      orderData.shipping_address?.pincode ||
      orderData.shipping_address?.zip ||
      orderData.billing_address?.zip ||
      "",
  );

  const state =
    orderData.state ||
    orderData.shipping_address?.state ||
    orderData.billing_address?.state ||
    deriveStateFromPincode(pincode);

  return {
    orderNumber: String(
      orderData.order_number ||
        orderData.order_id ||
        orderData.cart_id ||
        savedOrder?._id ||
        "N/A",
    ),
    customerName: fullName,
    customerEmail,
    customerPhone: formattedPhone,
    createdAt: orderData.created_at || new Date(),
    // Shiprocket sends "SUCCESS" here; show customers something readable.
    status: /^success$/i.test(String(orderData.status || ""))
      ? "Confirmed"
      : orderData.status || "Confirmed",
    items,
    pricing: {
      subtotal,
      shippingCharge,
      discountAmount,
      total,
    },
    payment: {
      method: String(
        orderData.payment_type || orderData.payment_mode || "Prepaid",
      ).toUpperCase(),
      status: orderData.financial_status || orderData.status || "Paid",
    },
    shippingAddress: {
      fullName,
      addressLine1:
        orderData.address_line1 ||
        orderData.shipping_address?.address1 ||
        orderData.billing_address?.address1 ||
        "",
      addressLine2:
        orderData.address_line2 ||
        orderData.shipping_address?.address2 ||
        orderData.billing_address?.address2 ||
        "",
      city:
        orderData.city ||
        orderData.shipping_address?.city ||
        orderData.billing_address?.city ||
        "",
      state,
      pincode,
      country:
        orderData.country || orderData.shipping_address?.country || "India",
    },
  };
}

// The order webhook payload is minimal — per the integration guide it carries
// only order_id, cart_data.items[{variant_id, quantity}], status, phone, email,
// payment_type and total_amount_payable. No item names, no prices, no address.
// Treat it as thin whenever the line items carry no descriptive fields or the
// shipping address is absent.
function isThinShiprocketPayload(orderData) {
  const items =
    orderData.cart_data?.items ||
    orderData.line_items ||
    orderData.products ||
    orderData.items ||
    [];
  const itemsLackDetail =
    !items.length || items.every((i) => !i.name && !i.title && !i.price);
  const hasAddress = Boolean(
    orderData.shipping_address?.address1 ||
      orderData.billing_address?.address1 ||
      orderData.address_line1,
  );
  // No email anywhere is also worth a lookup — without it no invoice can go
  // out and the order cannot be persisted (customerEmail is required).
  const hasEmail = Boolean(
    orderData.email ||
      orderData.customer?.email ||
      orderData.shipping_address?.email ||
      orderData.billing_address?.email,
  );
  return itemsLackDetail || !hasAddress || !hasEmail;
}

// Fetch Order Details API (integration guide §6) — the documented way to turn
// an order_id into the full cart, payment and shipping detail. Returns null on
// any failure so the caller can carry on with whatever the webhook gave us.
async function fetchShiprocketOrderDetails(orderId) {
  const apiKey = process.env.SHIPROCKET_API_KEY;
  const secretKey = process.env.SHIPROCKET_SECRET_KEY;

  if (!apiKey || !secretKey) {
    console.warn(
      "[Shiprocket Order Details] Skipped — SHIPROCKET_API_KEY / SHIPROCKET_SECRET_KEY not configured",
    );
    return null;
  }

  const url =
    process.env.SHIPROCKET_ORDER_DETAILS_URL ||
    "https://checkout-api.shiprocket.com/api/v1/custom-platform-order/details";

  const rawBody = JSON.stringify({
    order_id: String(orderId),
    timestamp: new Date().toISOString(),
  });

  try {
    const { data } = await axios.post(url, rawBody, {
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
        "X-Api-HMAC-SHA256": generateShiprocketHMAC(rawBody, secretKey),
      },
      timeout: 10000,
    });
    const details = data?.result || data?.data || data;
    console.log(`[Shiprocket Order Details] Enriched ${orderId}`);
    return details && typeof details === "object" ? details : null;
  } catch (err) {
    console.error(
      `[Shiprocket Order Details] Fetch failed for ${orderId}:`,
      err.response?.data || err.message,
    );
    return null;
  }
}

// Best-effort match of a Shiprocket line item back to a local product.
// Returns null rather than throwing — an unmatched item is still a valid
// order item (Order.items[].product allows null).
async function resolveProductIdBySku(sku) {
  if (!sku) return null;
  try {
    const product = await Product.findOne({
      $or: [{ sku }, { "variants.sku": sku }],
    })
      .select("_id")
      .lean();
    return product?._id || null;
  } catch {
    return null;
  }
}

// Maps the normalised notification payload onto a schema-valid Order document.
async function buildOrderDocFromShiprocket(orderData, np, shiprocketOrderId) {
  const rawMethod = String(
    orderData.payment_type || orderData.payment_mode || "prepaid",
  ).toLowerCase();
  const isCod = rawMethod.includes("cod") || rawMethod.includes("cash");

  const rawPaymentStatus = String(
    orderData.financial_status || orderData.status || "",
  ).toLowerCase();
  const isPaid = /paid|captured|success|complete/.test(rawPaymentStatus);

  const items = await Promise.all(
    np.items.map(async (item) => ({
      product: await resolveProductIdBySku(item.sku),
      name: item.name,
      slug: item.slug,
      sku: item.sku,
      image: item.image,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  );

  return {
    shiprocketOrderId,
    rawShiprocketData: orderData,
    customerName: np.customerName,
    customerEmail: np.customerEmail,
    customerPhone: np.customerPhone,
    items,
    shippingAddress: {
      fullName: np.shippingAddress.fullName,
      phone: np.customerPhone,
      addressLine1: np.shippingAddress.addressLine1,
      addressLine2: np.shippingAddress.addressLine2,
      city: np.shippingAddress.city,
      state: np.shippingAddress.state,
      pincode: np.shippingAddress.pincode,
      country: np.shippingAddress.country,
    },
    pricing: {
      subtotal: np.pricing.subtotal || np.pricing.total,
      shippingCharge: np.pricing.shippingCharge,
      discountAmount: np.pricing.discountAmount,
      total: np.pricing.total,
    },
    payment: {
      method: isCod ? "cod" : "shiprocket",
      status: isCod ? "pending" : isPaid ? "paid" : "initiated",
      amountPaid: isCod || !isPaid ? 0 : np.pricing.total,
      paidAt: !isCod && isPaid ? new Date() : null,
    },
    status: "confirmed",
    confirmedAt: new Date(),
    source: "shiprocket",
  };
}

// Backstop against duplicate deliveries: Shiprocket fires this webhook more
// than once per order, and the DB-backed `notificationsSentAt` guard only
// helps when the order actually persisted. In-process and time-boxed — good
// enough to stop a double-send on a single instance.
const recentlyNotified = new Map();
const NOTIFY_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

function alreadyNotifiedRecently(id) {
  const seenAt = recentlyNotified.get(id);
  const now = Date.now();
  for (const [key, ts] of recentlyNotified) {
    if (now - ts > NOTIFY_DEDUPE_WINDOW_MS) recentlyNotified.delete(key);
  }
  if (seenAt && now - seenAt < NOTIFY_DEDUPE_WINDOW_MS) return true;
  recentlyNotified.set(id, now);
  return false;
}

const handleOrderWebhook = async (req, res) => {
  const t0 = Date.now();
  console.log("🚀 [WEBHOOK HIT] Received payload from Shiprocket:", req.body);
  try {
    let orderData = req.body;

    // The live "Order Placed" webhook identifies the order by `cart_id` only —
    // it carries no order_id/order_number at all. Requiring those was silently
    // 400-ing every real delivery before a single notification was attempted.
    const shiprocketOrderId = String(
      orderData?.order_id ||
        orderData?.order_number ||
        orderData?.cart_id ||
        "",
    );

    if (!orderData || !shiprocketOrderId) {
      console.error(
        "❌ [WEBHOOK REJECTED] No order_id / order_number / cart_id in payload. Keys received:",
        Object.keys(orderData || {}),
      );
      return res
        .status(400)
        .json({ status: "FAILED", message: "Invalid payload" });
    }

    console.log(
      `✅ [WEBHOOK ACCEPTED] id=${shiprocketOrderId} stage=${orderData.latest_stage || "n/a"} source=${orderData.source_name || "n/a"}`,
    );

    // 0. The webhook payload alone is too sparse to build an invoice or a
    //    valid Order from, so pull the full record when anything is missing.
    if (isThinShiprocketPayload(orderData)) {
      console.log(
        `[Shiprocket Webhook] Thin payload for ${shiprocketOrderId} — fetching full order details`,
      );
      const details = await fetchShiprocketOrderDetails(shiprocketOrderId);
      if (details) {
        orderData = {
          ...orderData,
          ...details,
          cart_data: details.cart_data || orderData.cart_data,
          shipping_address: {
            ...(orderData.shipping_address || {}),
            ...(details.shipping_address || {}),
          },
        };
      }
    }

    // 1. Normalise the payload FIRST. Everything below — persistence, Engage
    //    sync, notifications — is independent and individually guarded, so a
    //    failure in one step can never silently swallow the others. The
    //    previous version awaited an unguarded upsert here, and any error
    //    jumped straight to the catch block without sending a single
    //    notification.
    const notificationOrderPayload =
      transformShiprocketOrderToNotificationFormat(orderData, null);

    const np = notificationOrderPayload;
    console.log("📦 [NORMALISED PAYLOAD]", {
      orderNumber: np.orderNumber,
      customerName: np.customerName,
      email: np.customerEmail || "(none — invoice email will be SKIPPED)",
      phone: np.customerPhone || "(none — SMS + WhatsApp will be SKIPPED)",
      items: np.items.map((i) => `${i.name} x${i.quantity} @${i.unitPrice}`),
      pricing: np.pricing,
      address: `${np.shippingAddress.city}, ${np.shippingAddress.state || "(no state)"} - ${np.shippingAddress.pincode || "(no pin)"}`,
    });

    if (!np.customerEmail) {
      console.warn(
        "⚠️  [NO EMAIL] Shiprocket payload carried no email address — customer invoice cannot be sent. Admin email still goes out.",
      );
    }
    if (!np.customerPhone) {
      console.warn(
        "⚠️  [NO PHONE] Shiprocket payload carried no phone — SMS and WhatsApp cannot be sent.",
      );
    }

    // 2. Save / Update Order in Database (never fatal)
    let savedOrder = null;
    try {
      const orderDoc = await buildOrderDocFromShiprocket(
        orderData,
        notificationOrderPayload,
        shiprocketOrderId,
      );

      savedOrder = await Order.findOne({ shiprocketOrderId });

      if (savedOrder) {
        savedOrder.set(orderDoc);
      } else {
        savedOrder = new Order(orderDoc);
      }

      // .save() (not findOneAndUpdate) so the pre-save hook assigns orderNumber
      await savedOrder.save();
      console.log(
        `💾 [ORDER SAVED] ${savedOrder.orderNumber} (shiprocket id ${shiprocketOrderId})`,
      );
    } catch (dbErr) {
      savedOrder = null;
      console.error(
        `❌ [ORDER PERSIST FAILED] ${shiprocketOrderId}: ${dbErr.message}`,
      );
      if (dbErr.errors) {
        console.error(
          "   missing/invalid fields:",
          Object.keys(dbErr.errors).join(", "),
        );
      }
      console.error(
        "   → notifications will STILL be attempted below; this only means the order row was not written.",
      );
    }

    // 3. Build Shiprocket Engage Order Webhook Payload & Sync
    const srCompanyId = Number(process.env.SHIPROCKET_COMPANY_ID || 1666579);
    const orderDate = new Date().toISOString();

    const lineItems = (
      orderData.cart_data?.items ||
      orderData.line_items ||
      []
    ).map((item) => ({
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
      orderId: String(orderData.order_id || orderData.order_number),
      order_number: String(orderData.order_number || orderData.order_id),
      customer_id: String(orderData.customer_id || "0"),
      phone: String(
        orderData.phone || orderData.shipping_address?.phone || "",
      ).replace(/^\+?91/, ""),
      fullName:
        `${orderData.first_name || ""} ${orderData.last_name || ""}`.trim() ||
        orderData.fullName ||
        "Customer",
      email: orderData.email || orderData.shipping_address?.email || "",
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

    // 4. Dispatch Notifications — deduped against the saved order when we have
    //    one, plus an in-process guard for when persistence failed.
    if (savedOrder?.orderNumber) {
      notificationOrderPayload.orderNumber = savedOrder.orderNumber;
    }

    if (!savedOrder && alreadyNotifiedRecently(shiprocketOrderId)) {
      console.log(
        `⏭️  [NOTIFICATIONS SKIPPED] ${shiprocketOrderId} was already notified within the last 10 min (duplicate webhook delivery)`,
      );
      return res.status(200).json({
        status: "SUCCESS",
        message: "Duplicate delivery — notifications already sent",
        persisted: false,
        notifications: null,
      });
    }

    console.log(`📨 [DISPATCHING NOTIFICATIONS] for ${np.orderNumber} ...`);

    const { skipped, results } = await dispatchOrderNotifications(
      notificationOrderPayload,
      { markOn: savedOrder },
    );

    console.log(
      `🏁 [WEBHOOK DONE] id=${shiprocketOrderId} persisted=${Boolean(savedOrder)} skipped=${skipped} results=${JSON.stringify(results)} in ${Date.now() - t0}ms`,
    );

    return res.status(200).json({
      status: "SUCCESS",
      message: skipped
        ? "Order processed, notifications already sent earlier"
        : "Order processed and notifications dispatched",
      persisted: Boolean(savedOrder),
      notifications: results || null,
      data: savedOrder,
    });
  } catch (error) {
    console.error("💥 [WEBHOOK FATAL]", error);
    // Still 200 — Shiprocket retries on non-2xx and the order has already been
    // handled as far as it could be. The log above is the signal to act on.
    return res.status(200).json({ status: "FAILED", error: error.message });
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
    return res.status(500).json({
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
