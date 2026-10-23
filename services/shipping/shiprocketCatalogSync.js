const axios = require("axios");
const Product = require("../../model/products/productModel");
const { generateShiprocketHMAC } = require("../../utils/shiprocketHmac");
const {
  formatProductForShiprocket,
} = require("../../controller/shiprocket/shiprocketController");

const PRODUCT_WEBHOOK_URL =
  process.env.SHIPROCKET_PRODUCT_WEBHOOK_URL ||
  "https://checkout-api.shiprocket.com/wh/v1/custom/product";

async function postProduct(formatted) {
  const apiKey = process.env.SHIPROCKET_API_KEY;
  const secret = process.env.SHIPROCKET_SECRET_KEY;
  if (!apiKey || !secret) {
    console.warn("[Shiprocket Catalog Sync] Skipped — API key/secret not set");
    return;
  }

  const rawBody = JSON.stringify(formatted);
  const { data } = await axios.post(PRODUCT_WEBHOOK_URL, rawBody, {
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
      "X-Api-HMAC-SHA256": generateShiprocketHMAC(rawBody, secret),
    },
    timeout: 10000,
  });
  console.log(
    `[Shiprocket Catalog Sync] product ${formatted.id} (${formatted.status}) →`,
    JSON.stringify(data),
  );
}

/**
 * Pushes the product's current state to Shiprocket so its catalog (variant
 * ids, prices, stock) matches ours. Fire-and-forget: a failure is logged and
 * never blocks the admin request.
 *
 * Pass `doc` for a product that no longer exists (deleted); it is sent as a
 * draft so Shiprocket stops offering it.
 */
function syncProductToShiprocket(productOrId, { deleted = false } = {}) {
  (async () => {
    let product = productOrId;
    if (!product || typeof product !== "object" || !product.name) {
      product = await Product.findById(productOrId).lean();
    } else if (typeof product.toObject === "function") {
      product = product.toObject();
    }
    if (!product) return;

    const formatted = formatProductForShiprocket(product);
    if (deleted) formatted.status = "draft";
    await postProduct(formatted);
  })().catch((err) =>
    console.error(
      "[Shiprocket Catalog Sync] Failed:",
      err.response?.status,
      err.response?.data || err.message,
    ),
  );
}

let bulkSyncRunning = false;

/**
 * Pushes every product (or just `ids`) one at a time and resolves with a
 * summary. Only one bulk run at a time.
 */
async function syncAllProductsToShiprocket(ids = []) {
  if (bulkSyncRunning) throw new Error("A catalog sync is already running");
  bulkSyncRunning = true;
  const summary = { total: 0, synced: 0, failed: [] };
  try {
    const products = await Product.find(
      ids.length ? { _id: { $in: ids } } : {},
    ).lean();
    summary.total = products.length;

    for (const p of products) {
      try {
        await postProduct(formatProductForShiprocket(p));
        summary.synced++;
      } catch (err) {
        summary.failed.push({
          id: String(p._id),
          name: p.name,
          error: err.response?.data || err.message,
        });
      }
      await new Promise((r) => setTimeout(r, 300)); // be gentle with the API
    }
    console.log(
      `[Shiprocket Catalog Sync] Bulk done: ${summary.synced}/${summary.total} synced, ${summary.failed.length} failed`,
    );
    return summary;
  } finally {
    bulkSyncRunning = false;
  }
}

module.exports = { syncProductToShiprocket, syncAllProductsToShiprocket };
