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

// Import Notification Services
const sendInvoiceEmail = require("../../services/mail/sendInvoiceEmail");
const sendSMSOrderConfirmation = require("../../services/notification/sendSMS");
const sendAdminOrderNotification = require("../../services/mail/sendAdminOrderNotification");
const sendWhatsappOrderConfirmation = require("../../services/notification/sendWhatsapp.js");

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

  const subtotal = Number(
    orderData.total_line_items_price || orderData.sub_total || 0,
  );
  const shippingCharge = Number(
    orderData.shipping_cost || orderData.shipping_charges || 0,
  );
  const discountAmount = Number(
    orderData.total_discounts || orderData.discount || 0,
  );
  const total = Number(
    orderData.total_amount_payable || orderData.total_price || 0,
  );

  return {
    orderNumber: String(
      orderData.order_number || orderData.order_id || savedOrder?._id || "N/A",
    ),
    customerName: fullName,
    customerEmail,
    customerPhone: formattedPhone,
    createdAt: orderData.created_at || new Date(),
    status: orderData.status || "Confirmed",
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
        orderData.address_line1 || orderData.shipping_address?.address1 || "",
      addressLine2:
        orderData.address_line2 || orderData.shipping_address?.address2 || "",
      city: orderData.city || orderData.shipping_address?.city || "",
      state: orderData.state || orderData.shipping_address?.state || "",
      pincode: orderData.zip || orderData.shipping_address?.pincode || "",
      country:
        orderData.country || orderData.shipping_address?.country || "India",
    },
  };
}

const handleOrderWebhook = async (req, res) => {
  console.log("🚀 [WEBHOOK HIT] Received payload from Shiprocket:", req.body);
  try {
    const orderData = req.body;

    if (!orderData || (!orderData.order_id && !orderData.order_number)) {
      return res
        .status(400)
        .json({ status: "FAILED", message: "Invalid payload" });
    }

    // 1. Save / Update Order in Database
    const savedOrder = await Order.findOneAndUpdate(
      {
        shiprocketOrderId: String(orderData.order_id || orderData.order_number),
      },
      {
        shiprocketOrderId: String(orderData.order_id || orderData.order_number),
        items: orderData.cart_data?.items || orderData.line_items || [],
        paymentStatus: orderData.status,
        customerPhone: orderData.phone || orderData.shipping_address?.phone,
        customerEmail: orderData.email || orderData.shipping_address?.email,
        paymentType: orderData.payment_type || orderData.payment_mode,
        totalAmount: orderData.total_amount_payable || orderData.total_price,
        rawShiprocketData: orderData,
      },
      { upsert: true, new: true },
    );

    // 2. Build Shiprocket Engage Order Webhook Payload & Sync
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

    // 3. Format Normalized Order Object for Notifications
    const notificationOrderPayload =
      transformShiprocketOrderToNotificationFormat(orderData, savedOrder);

    console.log("[Notification Payload Prepared]:", {
      email: notificationOrderPayload.customerEmail,
      phone: notificationOrderPayload.customerPhone,
      itemsCount: notificationOrderPayload.items.length,
    });

    // 4. Dispatch Notifications Asynchronously
    const notificationResults = await Promise.allSettled([
      // A. Customer Invoice Email (Brevo)
      notificationOrderPayload.customerEmail
        ? sendInvoiceEmail(notificationOrderPayload)
        : Promise.resolve("Skipped: No email address"),

      // B. Admin Notification Email (Brevo)
      sendAdminOrderNotification(notificationOrderPayload),

      // C. Customer SMS Notification (Twilio)
      notificationOrderPayload.customerPhone
        ? sendSMSOrderConfirmation(notificationOrderPayload)
        : Promise.resolve("Skipped: No phone number"),

      // D. Customer & Admin WhatsApp Notification (Twilio)
      notificationOrderPayload.customerPhone
        ? sendWhatsappOrderConfirmation(notificationOrderPayload)
        : Promise.resolve("Skipped: No phone number"),
    ]);

    notificationResults.forEach((result, idx) => {
      const labels = ["Customer Email", "Admin Email", "SMS", "WhatsApp"];
      if (result.status === "rejected") {
        console.error(
          `[Notification Error - ${labels[idx]}]:`,
          result.reason?.message || result.reason,
        );
      } else {
        console.log(`[Notification Success - ${labels[idx]}]:`, result.value);
      }
    });

    return res.status(200).json({
      status: "SUCCESS",
      message: "Order processed and notifications dispatched",
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
