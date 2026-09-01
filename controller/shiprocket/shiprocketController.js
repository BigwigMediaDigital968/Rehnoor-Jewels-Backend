const Product = require("../../model/products/productModel");
const Collection = require("../../model/collection/collectionModel");
const toNumericId = require("../../utils/toNumericId");

/**
 * Safely parses options regardless of whether they arrive as a
 * JS Map or a plain Object (from .lean()).
 */
function parseOptions(options) {
  if (!options) return {};
  if (options instanceof Map) {
    return Object.fromEntries(options);
  }
  if (typeof options === "object") {
    return options; // Already a plain object from .lean()
  }
  return {};
}

/**
 * Formats a single product document into Shiprocket's expected schema.
 */
function formatProductForShiprocket(p) {
  const hasVariants = p.variants && p.variants.length > 0;

  const variants = hasVariants
    ? p.variants.map((v) => ({
        id: toNumericId(v._id),
        title: v.title || "Default Title",
        price: Number(v.price || 0).toFixed(2),
        compare_at_price: v.originalPrice
          ? Number(v.originalPrice).toFixed(2)
          : "0.00",
        sku: v.sku || p.sku || "",
        quantity: v.stock !== null && v.stock !== undefined ? v.stock : 10,
        created_at: p.createdAt
          ? new Date(p.createdAt).toISOString()
          : new Date().toISOString(),
        updated_at: p.updatedAt
          ? new Date(p.updatedAt).toISOString()
          : new Date().toISOString(),
        taxable: true,
        option_values: parseOptions(v.options),
      }))
    : [
        {
          id: toNumericId(p._id),
          title: "Default Title",
          price: Number(p.price || 0).toFixed(2),
          compare_at_price: p.originalPrice
            ? Number(p.originalPrice).toFixed(2)
            : "0.00",
          sku: p.sku || "",
          quantity: p.stock !== null && p.stock !== undefined ? p.stock : 10,
          created_at: p.createdAt
            ? new Date(p.createdAt).toISOString()
            : new Date().toISOString(),
          updated_at: p.updatedAt
            ? new Date(p.updatedAt).toISOString()
            : new Date().toISOString(),
          taxable: true,
          option_values: {},
        },
      ];

  return {
    id: toNumericId(p._id),
    title: p.name || "",
    body_html: p.longDescription || p.shortDescription || "<p></p>",
    vendor: "Rehnoor Jewels",
    product_type: p.category || "Jewelry",
    created_at: p.createdAt
      ? new Date(p.createdAt).toISOString()
      : new Date().toISOString(),
    handle: p.slug || "",
    updated_at: p.updatedAt
      ? new Date(p.updatedAt).toISOString()
      : new Date().toISOString(),
    tags: p.seoKeywords ? p.seoKeywords.join(", ") : p.tag || "",
    status: p.isActive ? "active" : "draft",
    variants: variants,
    images: (p.images || []).map((img) => ({
      src: img.src,
      alt: img.alt || p.name,
    })),
  };
}

// 1. Fetch Catalog / Products
const getShiprocketProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ isActive: true }).skip(skip).limit(limit).lean(),
      Product.countDocuments({ isActive: true }),
    ]);

    const formattedProducts = products.map(formatProductForShiprocket);

    return res.status(200).json({
      data: {
        total,
        products: formattedProducts,
      },
    });
  } catch (error) {
    console.error("[Shiprocket API] Products Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// 2. Fetch Single Product
const getShiprocketProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const products = await Product.find({ isActive: true }).lean();

    const product = products.find((p) => toNumericId(p._id) === parseInt(id));

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.status(200).json({
      data: formatProductForShiprocket(product),
    });
  } catch (error) {
    console.error("[Shiprocket API] Single Product Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// 3. Fetch Collections
const getShiprocketCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ isActive: true }).lean();

    const formattedCollections = collections.map((col) => ({
      id: toNumericId(col._id),
      title: col.name,
      handle: col.slug,
      updated_at: col.updatedAt
        ? new Date(col.updatedAt).toISOString()
        : new Date().toISOString(),
      body_html: col.description || "",
      published_at: col.createdAt
        ? new Date(col.createdAt).toISOString()
        : new Date().toISOString(),
      sort_order: "best-selling",
      template_suffix: null,
      products_count:
        col.productCount || (col.products ? col.products.length : 0),
    }));

    return res.status(200).json({
      data: {
        collections: formattedCollections,
      },
    });
  } catch (error) {
    console.error("[Shiprocket API] Collections Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// 4. Fetch Products by Collection (Accepts Numeric ID, Mongo ObjectId, or Slug)
const getShiprocketProductsByCollection = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const collections = await Collection.find({ isActive: true }).lean();

    // Find target collection by matching Numeric ID, ObjectId string, or Slug
    const col = collections.find(
      (c) =>
        toNumericId(c._id) === parseInt(idOrSlug) ||
        c._id.toString() === idOrSlug ||
        c.slug === idOrSlug,
    );

    if (!col) {
      return res.status(404).json({ error: "Collection not found" });
    }

    const products = await Product.find({
      collection: col._id,
      isActive: true,
    }).lean();

    const formattedProducts = products.map(formatProductForShiprocket);

    return res.status(200).json({
      data: {
        total: formattedProducts.length,
        products: formattedProducts,
      },
    });
  } catch (error) {
    console.error("[Shiprocket API] Collection Products Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getShiprocketProducts,
  getShiprocketProductById,
  getShiprocketCollections,
  getShiprocketProductsByCollection,
};
