// const axios = require("axios");
// const crypto = require("crypto");
// const Order = require("../../model/Order/orderModel");
// const Product = require("../../model/products/productModel");
// const toNumericId = require("../../utils/toNumericId");

// const dispatchOrderNotifications = require("../../services/notification/dispatchOrderNotifications");

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

//     const missingEnv = ["SHIPROCKET_API_KEY", "SHIPROCKET_SECRET_KEY"].filter(
//       (key) => !process.env[key],
//     );

//     if (missingEnv.length) {
//       console.error(
//         `[Shiprocket Access Token] Missing env vars: ${missingEnv.join(", ")}`,
//       );
//       return res.status(500).json({
//         error: "Shiprocket checkout is not configured",
//         details: `Missing environment variables: ${missingEnv.join(", ")}`,
//       });
//     }

//     const sellerDomain = process.env.SELLER_DOMAIN || "www.rehnoorjewels.com";

//     const sanitizedRedirectUrl =
//       redirectUrl && !redirectUrl.includes("localhost")
//         ? redirectUrl
//         : `https://${sellerDomain}/thankyou`;

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

// const PIN_ZONE_TO_STATE = {
//   11: "Delhi",
//   12: "Haryana",
//   13: "Haryana",
//   14: "Punjab",
//   15: "Punjab",
//   16: "Chandigarh",
//   17: "Himachal Pradesh",
//   18: "Jammu & Kashmir",
//   19: "Jammu & Kashmir",
//   20: "Uttar Pradesh",
//   21: "Uttar Pradesh",
//   22: "Uttar Pradesh",
//   23: "Uttar Pradesh",
//   24: "Uttar Pradesh",
//   25: "Uttar Pradesh",
//   26: "Uttar Pradesh",
//   27: "Uttar Pradesh",
//   28: "Uttar Pradesh",
//   30: "Rajasthan",
//   31: "Rajasthan",
//   32: "Rajasthan",
//   33: "Rajasthan",
//   34: "Rajasthan",
//   36: "Gujarat",
//   37: "Gujarat",
//   38: "Gujarat",
//   39: "Gujarat",
//   40: "Maharashtra",
//   41: "Maharashtra",
//   42: "Maharashtra",
//   43: "Maharashtra",
//   44: "Maharashtra",
//   45: "Madhya Pradesh",
//   46: "Madhya Pradesh",
//   47: "Madhya Pradesh",
//   48: "Madhya Pradesh",
//   49: "Chhattisgarh",
//   50: "Telangana",
//   51: "Andhra Pradesh",
//   52: "Andhra Pradesh",
//   53: "Andhra Pradesh",
//   56: "Karnataka",
//   57: "Karnataka",
//   58: "Karnataka",
//   59: "Karnataka",
//   60: "Tamil Nadu",
//   61: "Tamil Nadu",
//   62: "Tamil Nadu",
//   63: "Tamil Nadu",
//   64: "Tamil Nadu",
//   67: "Kerala",
//   68: "Kerala",
//   69: "Kerala",
//   70: "West Bengal",
//   71: "West Bengal",
//   72: "West Bengal",
//   73: "West Bengal",
//   74: "West Bengal",
//   75: "Odisha",
//   76: "Odisha",
//   77: "Odisha",
//   78: "Assam",
//   79: "North East",
//   80: "Bihar",
//   81: "Jharkhand",
//   82: "Jharkhand",
//   83: "Jharkhand",
//   84: "Bihar",
//   85: "Bihar",
// };

// function deriveStateFromPincode(pincode) {
//   const digits = String(pincode || "").replace(/\D/g, "");
//   if (digits.length !== 6) return "";
//   return PIN_ZONE_TO_STATE[digits.slice(0, 2)] || "";
// }

// // ─── Extended Product/Variant Resolver ───────────────────────────────────────
// async function resolveProductAndVariantBySku(sku, variantIdOrNumericId) {
//   if (!sku && !variantIdOrNumericId)
//     return { productId: null, variantSnapshot: null };

//   try {
//     const isObjectId =
//       typeof variantIdOrNumericId === "string" &&
//       /^[0-9a-fA-F]{24}$/.test(variantIdOrNumericId);

//     const queryConditions = [];
//     if (sku) {
//       queryConditions.push({ sku }, { "variants.sku": sku });
//     }
//     if (isObjectId) {
//       queryConditions.push({ "variants._id": variantIdOrNumericId });
//     }

//     let product = queryConditions.length
//       ? await Product.findOne({ $or: queryConditions }).lean()
//       : null;

//     // Live webhooks send no SKU, only the numeric id we gave Shiprocket in the
//     // catalog sync (an md5 hash of the product/variant _id), so match on that.
//     const numericId = Number(variantIdOrNumericId);
//     if (!product && numericId) {
//       const candidates = await Product.find({})
//         .select("_id sku images variants")
//         .lean();
//       product = candidates.find(
//         (p) =>
//           toNumericId(p._id) === numericId ||
//           (p.variants || []).some((v) => toNumericId(v._id) === numericId),
//       );
//     }

//     if (!product) return { productId: null, variantSnapshot: null };

//     let variantSnapshot = null;
//     let image = product.images?.[0]?.src || "";
//     if (product.variants && product.variants.length > 0) {
//       const matchedVariant = product.variants.find(
//         (v) =>
//           (v.sku && v.sku === sku) ||
//           String(v._id) === String(variantIdOrNumericId) ||
//           toNumericId(v._id) === Number(variantIdOrNumericId),
//       );

//       if (matchedVariant) {
//         variantSnapshot = {
//           variantId: matchedVariant._id,
//           title: matchedVariant.title || "",
//           sku: matchedVariant.sku || product.sku || "",
//           options: matchedVariant.options
//             ? matchedVariant.options instanceof Map
//               ? Object.fromEntries(matchedVariant.options)
//               : matchedVariant.options
//             : {},
//         };
//         image = matchedVariant.images?.[0]?.src || image;
//       }
//     }

//     return {
//       productId: product._id,
//       variantSnapshot,
//       image,
//     };
//   } catch (error) {
//     console.error("[Shiprocket Webhook] Product lookup failed:", error.message);
//     return { productId: null, variantSnapshot: null };
//   }
// }

// // ─── Deduct Inventory Post-Order ──────────────────────────────────────────────
// async function deductOrderInventory(items) {
//   for (const item of items) {
//     if (!item.product) continue;
//     try {
//       if (item.variant?.variantId) {
//         await Product.updateOne(
//           {
//             _id: item.product,
//             "variants._id": item.variant.variantId,
//             "variants.stock": { $ne: null },
//           },
//           { $inc: { "variants.$.stock": -item.quantity } },
//         );
//       } else {
//         await Product.updateOne(
//           { _id: item.product, stock: { $ne: null } },
//           { $inc: { stock: -item.quantity } },
//         );
//       }
//     } catch (err) {
//       console.error(
//         `[Inventory Deduct Failed] product=${item.product}:`,
//         err.message,
//       );
//     }
//   }
// }

// function transformShiprocketOrderToNotificationFormat(orderData, savedOrder) {
//   const firstName =
//     orderData.first_name ||
//     orderData.shipping_address?.first_name ||
//     orderData.billing_address?.first_name ||
//     "";
//   const lastName =
//     orderData.last_name ||
//     orderData.shipping_address?.last_name ||
//     orderData.billing_address?.last_name ||
//     "";

//   const fullName =
//     `${firstName} ${lastName}`.trim() ||
//     orderData.fullName ||
//     orderData.shipping_address?.name ||
//     "Valued Customer";

//   let rawPhone =
//     orderData.phone ||
//     orderData.shipping_address?.phone ||
//     orderData.billing_address?.phone ||
//     orderData.customer?.phone ||
//     "";

//   let formattedPhone = String(rawPhone).replace(/\D/g, "");

//   if (formattedPhone.length === 10) {
//     formattedPhone = `+91${formattedPhone}`;
//   } else if (formattedPhone.length > 10 && formattedPhone.startsWith("91")) {
//     formattedPhone = `+${formattedPhone}`;
//   } else if (formattedPhone.length > 0 && !formattedPhone.startsWith("+")) {
//     formattedPhone = `+${formattedPhone}`;
//   } else {
//     formattedPhone = "";
//   }

//   const customerEmail =
//     orderData.email ||
//     orderData.customer?.email ||
//     orderData.shipping_address?.email ||
//     orderData.billing_address?.email ||
//     "";

//   const rawItems =
//     orderData.cart_data?.items ||
//     orderData.line_items ||
//     orderData.products ||
//     orderData.items ||
//     [];

//   const items = rawItems.map((item) => {
//     const unitPrice = Number(item.price || item.unit_price || 0);
//     const quantity = Number(item.quantity || item.qty || 1);
//     return {
//       name: item.name || item.title || "Product",
//       sku: item.sku || "",
//       slug: item.slug || "",
//       image: item.image || item.src || "",
//       quantity,
//       unitPrice,
//       lineTotal: unitPrice * quantity,
//     };
//   });

//   const itemsTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

//   const subtotal = Number(
//     orderData.total_line_items_price ||
//       orderData.sub_total ||
//       orderData.total_price ||
//       itemsTotal ||
//       0,
//   );
//   const shippingCharge = Number(
//     orderData.shipping_cost ||
//       orderData.shipping_charges ||
//       orderData.shipping_price ||
//       0,
//   );
//   const discountAmount = Number(
//     orderData.total_discounts ||
//       orderData.discount ||
//       orderData.total_discount ||
//       0,
//   );
//   const total = Number(
//     orderData.total_amount_payable ||
//       subtotal + shippingCharge - discountAmount ||
//       0,
//   );

//   const pincode = String(
//     orderData.zip ||
//       orderData.shipping_address?.pincode ||
//       orderData.shipping_address?.zip ||
//       orderData.billing_address?.zip ||
//       "",
//   );

//   const state =
//     orderData.state ||
//     orderData.shipping_address?.state ||
//     orderData.billing_address?.state ||
//     deriveStateFromPincode(pincode);

//   return {
//     orderNumber: String(
//       orderData.order_number ||
//         orderData.order_id ||
//         orderData.cart_id ||
//         savedOrder?._id ||
//         "N/A",
//     ),
//     customerName: fullName,
//     customerEmail: customerEmail,
//     customerPhone: formattedPhone,
//     createdAt: orderData.created_at || new Date(),
//     status: /^success$/i.test(String(orderData.status || ""))
//       ? "Confirmed"
//       : orderData.status || "Confirmed",
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
//         orderData.address_line1 ||
//         orderData.shipping_address?.address1 ||
//         orderData.billing_address?.address1 ||
//         "",
//       addressLine2:
//         orderData.address_line2 ||
//         orderData.shipping_address?.address2 ||
//         orderData.billing_address?.address2 ||
//         "",
//       city:
//         orderData.city ||
//         orderData.shipping_address?.city ||
//         orderData.billing_address?.city ||
//         "",
//       state,
//       pincode,
//       country:
//         orderData.country || orderData.shipping_address?.country || "India",
//     },
//   };
// }

// function isThinShiprocketPayload(orderData) {
//   const items =
//     orderData.cart_data?.items ||
//     orderData.line_items ||
//     orderData.products ||
//     orderData.items ||
//     [];
//   const itemsLackDetail =
//     !items.length || items.every((i) => !i.name && !i.title && !i.price);
//   const hasAddress = Boolean(
//     orderData.shipping_address?.address1 ||
//       orderData.billing_address?.address1 ||
//       orderData.address_line1,
//   );
//   const hasEmail = Boolean(
//     orderData.email ||
//       orderData.customer?.email ||
//       orderData.shipping_address?.email ||
//       orderData.billing_address?.email,
//   );
//   return itemsLackDetail || !hasAddress || !hasEmail;
// }

// async function fetchShiprocketOrderDetails(orderId) {
//   const apiKey = process.env.SHIPROCKET_API_KEY;
//   const secretKey = process.env.SHIPROCKET_SECRET_KEY;

//   if (!apiKey || !secretKey) {
//     console.warn(
//       "[Shiprocket Order Details] Skipped — SHIPROCKET_API_KEY / SHIPROCKET_SECRET_KEY not configured",
//     );
//     return null;
//   }

//   const url =
//     process.env.SHIPROCKET_ORDER_DETAILS_URL ||
//     "https://checkout-api.shiprocket.com/api/v1/custom-platform-order/details";

//   const rawBody = JSON.stringify({
//     order_id: String(orderId),
//     timestamp: new Date().toISOString(),
//   });

//   try {
//     const { data } = await axios.post(url, rawBody, {
//       headers: {
//         "Content-Type": "application/json",
//         "X-Api-Key": apiKey,
//         "X-Api-HMAC-SHA256": generateShiprocketHMAC(rawBody, secretKey),
//       },
//       timeout: 10000,
//     });
//     const details = data?.result || data?.data || data;
//     console.log(`[Shiprocket Order Details] Enriched ${orderId}`);
//     return details && typeof details === "object" ? details : null;
//   } catch (err) {
//     console.error(
//       `[Shiprocket Order Details] Fetch failed for ${orderId}:`,
//       err.response?.data || err.message,
//     );
//     return null;
//   }
// }

// async function resolveProductIdBySku(sku) {
//   if (!sku) return null;
//   try {
//     const product = await Product.findOne({
//       $or: [{ sku }, { "variants.sku": sku }],
//     })
//       .select("_id")
//       .lean();
//     return product?._id || null;
//   } catch {
//     return null;
//   }
// }

// async function buildOrderDocFromShiprocket(orderData, np, shiprocketOrderId) {
//   const rawMethod = String(
//     orderData.payment_type || orderData.payment_mode || "prepaid",
//   ).toLowerCase();
//   const isCod = rawMethod.includes("cod") || rawMethod.includes("cash");

//   const rawPaymentStatus = String(
//     orderData.financial_status || orderData.status || "",
//   ).toLowerCase();
//   const isPaid = /paid|captured|success|complete/.test(rawPaymentStatus);

//   const rawItems =
//     orderData.cart_data?.items ||
//     orderData.line_items ||
//     orderData.products ||
//     orderData.items ||
//     [];

//   const items = await Promise.all(
//     np.items.map(async (item, idx) => {
//       const rawMatch = rawItems[idx] || {};
//       const variantIdentifier =
//         rawMatch.variant_id || rawMatch.variantId || item.variant_id;

//       const { productId, variantSnapshot, image } =
//         await resolveProductAndVariantBySku(item.sku, variantIdentifier);

//       return {
//         product: productId,
//         name: item.name,
//         slug: item.slug,
//         sku: item.sku,
//         image: item.image || image || "",
//         unitPrice: item.unitPrice,
//         quantity: item.quantity,
//         lineTotal: item.lineTotal,
//         variant: variantSnapshot,
//       };
//     }),
//   );

//   return {
//     shiprocketOrderId,
//     rawShiprocketData: orderData,
//     customerName: np.customerName,
//     customerEmail:
//       np.customerEmail ||
//       orderData.billing_address?.email ||
//       orderData.shipping_address?.email ||
//       "",
//     customerPhone: np.customerPhone,
//     items,
//     shippingAddress: {
//       fullName: np.shippingAddress.fullName,
//       phone: np.customerPhone,
//       addressLine1: np.shippingAddress.addressLine1,
//       addressLine2: np.shippingAddress.addressLine2,
//       city: np.shippingAddress.city,
//       state: np.shippingAddress.state,
//       pincode: np.shippingAddress.pincode,
//       country: np.shippingAddress.country,
//     },
//     pricing: {
//       subtotal: np.pricing.subtotal || np.pricing.total,
//       shippingCharge: np.pricing.shippingCharge,
//       discountAmount: np.pricing.discountAmount,
//       total: np.pricing.total,
//     },
//     payment: {
//       method: isCod ? "cod" : "shiprocket",
//       status: isCod ? "pending" : isPaid ? "paid" : "initiated",
//       amountPaid: isCod || !isPaid ? 0 : np.pricing.total,
//       paidAt: !isCod && isPaid ? new Date() : null,
//     },
//     status: "confirmed",
//     confirmedAt: new Date(),
//     source: "shiprocket",
//   };
// }

// const recentlyNotified = new Map();
// const NOTIFY_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

// function alreadyNotifiedRecently(id) {
//   const seenAt = recentlyNotified.get(id);
//   const now = Date.now();
//   for (const [key, ts] of recentlyNotified) {
//     if (now - ts > NOTIFY_DEDUPE_WINDOW_MS) recentlyNotified.delete(key);
//   }
//   if (seenAt && now - seenAt < NOTIFY_DEDUPE_WINDOW_MS) return true;
//   recentlyNotified.set(id, now);
//   return false;
// }

// const handleOrderWebhook = async (req, res) => {
//   const t0 = Date.now();
//   console.log("🚀 [WEBHOOK HIT] Received payload from Shiprocket:", req.body);
//   try {
//     let orderData = req.body;

//     const shiprocketOrderId = String(
//       orderData?.order_id ||
//         orderData?.order_number ||
//         orderData?.cart_id ||
//         "",
//     );

//     if (!orderData || !shiprocketOrderId) {
//       console.error(
//         "❌ [WEBHOOK REJECTED] No order_id / order_number / cart_id in payload. Keys received:",
//         Object.keys(orderData || {}),
//       );
//       return res
//         .status(400)
//         .json({ status: "FAILED", message: "Invalid payload" });
//     }

//     console.log(
//       `✅ [WEBHOOK ACCEPTED] id=${shiprocketOrderId} stage=${orderData.latest_stage || "n/a"} source=${orderData.source_name || "n/a"}`,
//     );

//     if (isThinShiprocketPayload(orderData)) {
//       console.log(
//         `[Shiprocket Webhook] Thin payload for ${shiprocketOrderId} — fetching full order details`,
//       );
//       const details = await fetchShiprocketOrderDetails(shiprocketOrderId);
//       if (details) {
//         orderData = {
//           ...orderData,
//           ...details,
//           cart_data: details.cart_data || orderData.cart_data,
//           shipping_address: {
//             ...(orderData.shipping_address || {}),
//             ...(details.shipping_address || {}),
//           },
//         };
//       }
//     }

//     const notificationOrderPayload =
//       transformShiprocketOrderToNotificationFormat(orderData, null);

//     const np = notificationOrderPayload;
//     console.log("📦 [NORMALISED PAYLOAD]", {
//       orderNumber: np.orderNumber,
//       customerName: np.customerName,
//       email: np.customerEmail || "(none — invoice email will be SKIPPED)",
//       phone: np.customerPhone || "(none — SMS + WhatsApp will be SKIPPED)",
//       items: np.items.map((i) => `${i.name} x${i.quantity} @${i.unitPrice}`),
//       pricing: np.pricing,
//       address: `${np.shippingAddress.city}, ${np.shippingAddress.state || "(no state)"} - ${np.shippingAddress.pincode || "(no pin)"}`,
//     });

//     if (!np.customerEmail) {
//       console.warn(
//         "⚠️  [NO EMAIL] Shiprocket payload carried no email address — customer invoice cannot be sent. Admin email still goes out.",
//       );
//     }
//     if (!np.customerPhone) {
//       console.warn(
//         "⚠️  [NO PHONE] Shiprocket payload carried no phone — SMS and WhatsApp cannot be sent.",
//       );
//     }

//     // 2. Save / Update Order in Database (never fatal)
//     let savedOrder = null;
//     let isNewOrder = false;
//     try {
//       const orderDoc = await buildOrderDocFromShiprocket(
//         orderData,
//         notificationOrderPayload,
//         shiprocketOrderId,
//       );

//       savedOrder = await Order.findOne({ shiprocketOrderId });

//       if (savedOrder) {
//         savedOrder.set(orderDoc);
//       } else {
//         savedOrder = new Order(orderDoc);
//         isNewOrder = true;
//       }

//       await savedOrder.save();

//       if (isNewOrder) {
//         await deductOrderInventory(savedOrder.items);
//       }

//       console.log(
//         `💾 [ORDER SAVED] ${savedOrder.orderNumber} (shiprocket id ${shiprocketOrderId})`,
//       );
//     } catch (dbErr) {
//       savedOrder = null;
//       console.error(
//         `❌ [ORDER PERSIST FAILED] ${shiprocketOrderId}: ${dbErr.message}`,
//       );

//       if (dbErr.errors) {
//         console.error(
//           "missing/invalid fields:",
//           Object.keys(dbErr.errors).join(", "),
//         );
//       }
//       console.error(
//         "   → notifications will STILL be attempted below; this only means the order row was not written.",
//       );
//     }

//     // 3. Build Shiprocket Engage Order Webhook Payload & Sync
//     const srCompanyId = Number(process.env.SHIPROCKET_COMPANY_ID || 1666579);
//     const orderDate = new Date().toISOString();

//     const lineItems = (
//       orderData.cart_data?.items ||
//       orderData.line_items ||
//       []
//     ).map((item) => ({
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
//       orderId: String(
//         orderData.order_id || orderData.order_number || orderData.cart_id,
//       ),
//       order_number: String(
//         orderData.order_number || orderData.order_id || orderData.cart_id,
//       ),
//       customer_id: String(orderData.customer_id || "0"),
//       phone: String(
//         orderData.phone || orderData.shipping_address?.phone || "",
//       ).replace(/^\+?91/, ""),
//       fullName:
//         `${orderData.first_name || ""} ${orderData.last_name || ""}`.trim() ||
//         orderData.fullName ||
//         "Customer",
//       // Safe email fallback so Shiprocket Engage validation does not fail
//       email:
//         orderData.email ||
//         orderData.shipping_address?.email ||
//         orderData.billing_address?.email ||
//         process.env.DEFAULT_FALLBACK_EMAIL ||
//         "noemail@rehnoorjewels.com",
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

//     // 4. Dispatch Notifications
//     if (savedOrder?.orderNumber) {
//       notificationOrderPayload.orderNumber = savedOrder.orderNumber;
//     }

//     if (!savedOrder && alreadyNotifiedRecently(shiprocketOrderId)) {
//       console.log(
//         `⏭️  [NOTIFICATIONS SKIPPED] ${shiprocketOrderId} was already notified within the last 10 min (duplicate webhook delivery)`,
//       );
//       return res.status(200).json({
//         status: "SUCCESS",
//         message: "Duplicate delivery — notifications already sent",
//         persisted: false,
//         notifications: null,
//       });
//     }

//     console.log(`📨 [DISPATCHING NOTIFICATIONS] for ${np.orderNumber} ...`);

//     const { skipped, results } = await dispatchOrderNotifications(
//       notificationOrderPayload,
//       { markOn: savedOrder },
//     );

//     console.log(
//       `🏁 [WEBHOOK DONE] id=${shiprocketOrderId} persisted=${Boolean(savedOrder)} skipped=${skipped} results=${JSON.stringify(results)} in ${Date.now() - t0}ms`,
//     );

//     return res.status(200).json({
//       status: "SUCCESS",
//       message: skipped
//         ? "Order processed, notifications already sent earlier"
//         : "Order processed and notifications dispatched",
//       persisted: Boolean(savedOrder),
//       notifications: results || null,
//       data: savedOrder,
//     });
//   } catch (error) {
//     console.error("💥 [WEBHOOK FATAL]", error);
//     return res.status(200).json({ status: "FAILED", error: error.message });
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

    const missingEnv = ["SHIPROCKET_API_KEY", "SHIPROCKET_SECRET_KEY"].filter(
      (key) => !process.env[key],
    );

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

// Helper to determine if an order is COD
function checkIsCodOrder(orderData) {
  const mode = String(
    orderData.payment_mode ||
      orderData.payment_type ||
      orderData.payment_method ||
      orderData.gateway ||
      "",
  ).toLowerCase();

  const financialStatus = String(
    orderData.financial_status || orderData.payment_status || "",
  ).toLowerCase();

  // If explicitly says cod or cash, OR financial status is pending with no online transaction ID
  if (mode.includes("cod") || mode.includes("cash") || orderData.is_cod === true) {
    return true;
  }

  // Fastrr webhook defaults for COD when financial_status is pending
  if (financialStatus === "pending" || financialStatus === "unpaid") {
    return true;
  }

  return false;
}

// ─── Extended Product/Variant Resolver ───────────────────────────────────────
async function resolveProductAndVariantBySku(sku, variantIdOrNumericId) {
  if (!sku && !variantIdOrNumericId)
    return { productId: null, variantSnapshot: null, image: "" };

  try {
    const isObjectId =
      typeof variantIdOrNumericId === "string" &&
      /^[0-9a-fA-F]{24}$/.test(variantIdOrNumericId);

    const queryConditions = [];
    if (sku) {
      queryConditions.push({ sku }, { "variants.sku": sku });
    }
    if (isObjectId) {
      queryConditions.push({ "variants._id": variantIdOrNumericId });
    }

    let product = queryConditions.length
      ? await Product.findOne({ $or: queryConditions }).lean()
      : null;

    const numericId = Number(variantIdOrNumericId);
    if (!product && numericId) {
      const candidates = await Product.find({})
        .select("_id sku images variants")
        .lean();
      product = candidates.find(
        (p) =>
          toNumericId(p._id) === numericId ||
          (p.variants || []).some((v) => toNumericId(v._id) === numericId),
      );
    }

    if (!product) return { productId: null, variantSnapshot: null, image: "" };

    let variantSnapshot = null;
    let image = product.images?.[0]?.src || "";
    if (product.variants && product.variants.length > 0) {
      const matchedVariant = product.variants.find(
        (v) =>
          (v.sku && v.sku === sku) ||
          String(v._id) === String(variantIdOrNumericId) ||
          toNumericId(v._id) === Number(variantIdOrNumericId),
      );

      if (matchedVariant) {
        variantSnapshot = {
          variantId: matchedVariant._id,
          title: matchedVariant.title || "",
          sku: matchedVariant.sku || product.sku || "",
          options: matchedVariant.options
            ? matchedVariant.options instanceof Map
              ? Object.fromEntries(matchedVariant.options)
              : matchedVariant.options
            : {},
        };
        image = matchedVariant.images?.[0]?.src || image;
      }
    }

    return {
      productId: product._id,
      variantSnapshot,
      image,
    };
  } catch (error) {
    console.error("[Shiprocket Webhook] Product lookup failed:", error.message);
    return { productId: null, variantSnapshot: null, image: "" };
  }
}

// ─── Deduct Inventory Post-Order ──────────────────────────────────────────────
async function deductOrderInventory(items) {
  for (const item of items) {
    if (!item.product) continue;
    try {
      if (item.variant?.variantId) {
        await Product.updateOne(
          {
            _id: item.product,
            "variants._id": item.variant.variantId,
            "variants.stock": { $ne: null },
          },
          { $inc: { "variants.$.stock": -item.quantity } },
        );
      } else {
        await Product.updateOne(
          { _id: item.product, stock: { $ne: null } },
          { $inc: { stock: -item.quantity } },
        );
      }
    } catch (err) {
      console.error(
        `[Inventory Deduct Failed] product=${item.product}:`,
        err.message,
      );
    }
  }
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
    formattedPhone = "";
  }

  const customerEmail =
    orderData.email ||
    orderData.customer?.email ||
    orderData.shipping_address?.email ||
    orderData.billing_address?.email ||
    "";

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
      image: item.image || item.src || "",
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });

  const itemsTotal = items.reduce((sum, i) => sum + i.lineTotal, 0);

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

  const isCod = checkIsCodOrder(orderData);

  return {
    orderNumber: String(
      orderData.order_number ||
        orderData.order_id ||
        orderData.cart_id ||
        savedOrder?._id ||
        "N/A",
    ),
    customerName: fullName,
    customerEmail: customerEmail,
    customerPhone: formattedPhone,
    createdAt: orderData.created_at || new Date(),
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
      method: isCod ? "COD" : "Prepaid",
      status: isCod ? "Pending" : "Paid",
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
  const hasEmail = Boolean(
    orderData.email ||
      orderData.customer?.email ||
      orderData.shipping_address?.email ||
      orderData.billing_address?.email,
  );
  return itemsLackDetail || !hasAddress || !hasEmail;
}

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

// The order webhook carries only cart_id and no payment info, while the
// Order Details API needs Fastrr's order_id. Find it via the Order List API
// and match on cart_id. Both ids are Mongo ObjectIds created ~1s apart, so
// candidates are checked nearest-timestamp first.
async function fetchShiprocketOrderDetailsByCartId(cartId) {
  const apiKey = process.env.SHIPROCKET_API_KEY;
  const secretKey = process.env.SHIPROCKET_SECRET_KEY;
  if (!apiKey || !secretKey || !cartId) return null;

  const now = new Date();
  const iso = (d) => d.toISOString().replace(/\.\d+Z$/, "Z");
  const rawBody = JSON.stringify({
    startDate: iso(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
    endDate: iso(now),
    timestamp: now.toISOString(),
    limit: 250,
    page: 0,
  });

  try {
    const { data } = await axios.post(
      "https://checkout-api.shiprocket.com/api/v1/custom-platform-order/details/list",
      rawBody,
      {
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
          "X-Api-HMAC-SHA256": generateShiprocketHMAC(rawBody, secretKey),
        },
        timeout: 10000,
      },
    );

    const cartTs = parseInt(String(cartId).slice(0, 8), 16);
    const candidates = (data?.result?.data || [])
      .map((o) => o.id)
      .filter(Boolean)
      .sort(
        (a, b) =>
          Math.abs(parseInt(a.slice(0, 8), 16) - cartTs) -
          Math.abs(parseInt(b.slice(0, 8), 16) - cartTs),
      )
      .slice(0, 10);

    for (const orderId of candidates) {
      const details = await fetchShiprocketOrderDetails(orderId);
      if (details && String(details.cart_id) === String(cartId)) {
        return details;
      }
    }
    console.warn(
      `[Shiprocket Order Details] No Fastrr order found for cart_id ${cartId}`,
    );
    return null;
  } catch (err) {
    console.error(
      `[Shiprocket Order List] Fetch failed for cart_id ${cartId}:`,
      err.response?.data || err.message,
    );
    return null;
  }
}

async function buildOrderDocFromShiprocket(orderData, np, shiprocketOrderId) {
  const isCod = checkIsCodOrder(orderData);
  const rawPaymentStatus = String(
    orderData.financial_status || orderData.payment_status || "",
  ).toLowerCase();
  const isPaid = !isCod && /paid|captured|success|complete/.test(rawPaymentStatus);

  const rawItems =
    orderData.cart_data?.items ||
    orderData.line_items ||
    orderData.products ||
    orderData.items ||
    [];

  const items = await Promise.all(
    np.items.map(async (item, idx) => {
      const rawMatch = rawItems[idx] || {};
      const variantIdentifier =
        rawMatch.variant_id || rawMatch.variantId || item.variant_id;

      const { productId, variantSnapshot, image } =
        await resolveProductAndVariantBySku(item.sku, variantIdentifier);

      return {
        product: productId,
        name: item.name,
        slug: item.slug,
        sku: item.sku,
        image: item.image || image || "",
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        variant: variantSnapshot,
      };
    }),
  );

  return {
    shiprocketOrderId,
    rawShiprocketData: orderData,
    customerName: np.customerName,
    customerEmail:
      np.customerEmail ||
      orderData.billing_address?.email ||
      orderData.shipping_address?.email ||
      "",
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

    const lacksPayment = !orderData.payment_type && !orderData.payment_mode;
    if (isThinShiprocketPayload(orderData) || lacksPayment) {
      console.log(
        `[Shiprocket Webhook] Thin payload for ${shiprocketOrderId} — fetching full order details`,
      );
      const details = orderData.order_id
        ? await fetchShiprocketOrderDetails(orderData.order_id)
        : await fetchShiprocketOrderDetailsByCartId(orderData.cart_id);
      if (details) {
        console.log(
          `[Shiprocket Order Details] ${shiprocketOrderId} → order ${details.order_id} payment=${details.payment_type}/${details.payment_status}`,
        );
        const webhookItems =
          orderData.cart_data?.items || orderData.line_items || orderData.items;
        orderData = {
          ...orderData,
          ...details,
          // Details items carry only variant_id/quantity/price — keep the
          // webhook's items (with names) when it has them.
          cart_data: webhookItems?.length
            ? { items: webhookItems }
            : details.cart_data || orderData.cart_data,
          shipping_address: {
            ...(orderData.shipping_address || {}),
            ...(details.shipping_address || {}),
          },
          billing_address: {
            ...(orderData.billing_address || {}),
            ...(details.billing_address || {}),
          },
        };
      }
    }

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

    // 2. Save / Update Order in Database
    let savedOrder = null;
    let isNewOrder = false;
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
        isNewOrder = true;
      }

      await savedOrder.save();

      if (isNewOrder) {
        await deductOrderInventory(savedOrder.items);
      }

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
          "missing/invalid fields:",
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
      orderData.items ||
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

    const isCodMode = checkIsCodOrder(orderData);
    const calculatedSubtotal = Number(
      orderData.total_line_items_price ||
        orderData.sub_total ||
        orderData.total_price ||
        np.pricing.subtotal ||
        0,
    );

    const engageOrderPayload = {
      sr_company_id: srCompanyId,
      orderId: String(
        orderData.order_id || orderData.order_number || orderData.cart_id,
      ),
      order_number: String(
        orderData.order_number || orderData.order_id || orderData.cart_id,
      ),
      customer_id: String(orderData.customer_id || "0"),
      phone: String(
        orderData.phone || orderData.shipping_address?.phone || "",
      ).replace(/^\+?91/, ""),
      fullName:
        `${orderData.first_name || ""} ${orderData.last_name || ""}`.trim() ||
        orderData.fullName ||
        "Customer",
      email:
        orderData.email ||
        orderData.shipping_address?.email ||
        orderData.billing_address?.email ||
        process.env.DEFAULT_FALLBACK_EMAIL ||
        "noemail@rehnoorjewels.com",
      total_price: Number(
        orderData.total_amount_payable || orderData.total_price || np.pricing.total || 0,
      ),
      total_line_items_price: calculatedSubtotal, // Required by Shiprocket Engage
      cart_token: orderData.cart_token || "",
      checkout_token: orderData.checkout_token || "",
      ga_transaction_id: "",
      created_at: orderData.created_at || orderDate,
      updated_at: orderData.updated_at || orderDate,
      shipping_cost: Number(orderData.shipping_cost || orderData.shipping_price || 0),
      total_discounts: Number(orderData.total_discounts || 0),
      city: orderData.city || orderData.shipping_address?.city || "",
      state: orderData.state || orderData.shipping_address?.state || "",
      country:
        orderData.country || orderData.shipping_address?.country || "India",
      zip: String(orderData.zip || orderData.shipping_address?.pincode || orderData.shipping_address?.zip || ""),
      payment_mode: isCodMode ? "COD" : "Prepaid",
      taxes_included: true,
      total_tax: Number(orderData.total_tax || 0),
      order_mode: "Online",
      coupons: orderData.coupons || [],
      line_items: lineItems,
      userId: String(orderData.userId || ""),
      source: "web",
      payment_method: isCodMode ? "cod" : "prepaid",
      address_line1:
        orderData.address_line1 || orderData.shipping_address?.address1 || "",
      address_line2:
        orderData.address_line2 || orderData.shipping_address?.address2 || "",
      financial_status: isCodMode ? "Pending" : "Paid",
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

    // 4. Dispatch Notifications
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