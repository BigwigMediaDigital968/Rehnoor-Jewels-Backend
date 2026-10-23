// One-off: push products to Shiprocket's catalog.
//   node utils/syncShiprocketCatalog.js                 → every active product
//   node utils/syncShiprocketCatalog.js <productId> ... → just those products
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../model/products/productModel");
const { syncProductToShiprocket } = require("../services/shipping/shiprocketCatalogSync");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const ids = process.argv.slice(2);
  const products = await Product.find(ids.length ? { _id: { $in: ids } } : {}).lean();
  console.log(`Syncing ${products.length} product(s)...`);

  for (const p of products) {
    syncProductToShiprocket(p);
    // gentle pacing so Shiprocket's API isn't hammered
    await new Promise((r) => setTimeout(r, 300));
  }

  // let the fire-and-forget requests finish before exiting
  await new Promise((r) => setTimeout(r, 5000));
  await mongoose.disconnect();
})();
