// const Product = require("../../model/products/productModel");
// const Collection = require("../../model/collection/collectionModel");
// const toNumericId = require("../../utils/toNumericId");

// /**
//  * Safely parses options regardless of whether they arrive as a
//  * JS Map or a plain Object (from .lean()).
//  */
// function parseOptions(options) {
//   if (!options) return {};
//   if (options instanceof Map) {
//     return Object.fromEntries(options);
//   }
//   if (typeof options === "object") {
//     return options; // Already a plain object from .lean()
//   }
//   return {};
// }

// /**
//  * Formats a single product document into Shiprocket's expected schema.
//  */
// function formatProductForShiprocket(p) {
//   const hasVariants = p.variants && p.variants.length > 0;

//   const variants = hasVariants
//     ? p.variants.map((v) => ({
//         id: toNumericId(v._id),
//         title: v.title || "Default Title",
//         price: Number(v.price || 0).toFixed(2),
//         compare_at_price: v.originalPrice
//           ? Number(v.originalPrice).toFixed(2)
//           : "0.00",
//         sku: v.sku || p.sku || "",
//         quantity: v.stock !== null && v.stock !== undefined ? v.stock : 10,
//         created_at: p.createdAt
//           ? new Date(p.createdAt).toISOString()
//           : new Date().toISOString(),
//         updated_at: p.updatedAt
//           ? new Date(p.updatedAt).toISOString()
//           : new Date().toISOString(),
//         taxable: true,
//         option_values: parseOptions(v.options),
//       }))
//     : [
//         {
//           id: toNumericId(p._id),
//           title: "Default Title",
//           price: Number(p.price || 0).toFixed(2),
//           compare_at_price: p.originalPrice
//             ? Number(p.originalPrice).toFixed(2)
//             : "0.00",
//           sku: p.sku || "",
//           quantity: p.stock !== null && p.stock !== undefined ? p.stock : 10,
//           created_at: p.createdAt
//             ? new Date(p.createdAt).toISOString()
//             : new Date().toISOString(),
//           updated_at: p.updatedAt
//             ? new Date(p.updatedAt).toISOString()
//             : new Date().toISOString(),
//           taxable: true,
//           option_values: {},
//         },
//       ];

//   return {
//     id: toNumericId(p._id),
//     title: p.name || "",
//     body_html: p.longDescription || p.shortDescription || "<p></p>",
//     vendor: "Rehnoor Jewels",
//     product_type: p.category || "Jewelry",
//     created_at: p.createdAt
//       ? new Date(p.createdAt).toISOString()
//       : new Date().toISOString(),
//     handle: p.slug || "",
//     updated_at: p.updatedAt
//       ? new Date(p.updatedAt).toISOString()
//       : new Date().toISOString(),
//     tags: p.seoKeywords ? p.seoKeywords.join(", ") : p.tag || "",
//     status: p.isActive ? "active" : "draft",
//     variants: variants,
//     images: (p.images || []).map((img) => ({
//       src: img.src,
//       alt: img.alt || p.name,
//     })),
//   };
// }

// // 1. Fetch Catalog / Products (Includes Pagination & Total Count)
// const getShiprocketProducts = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 100;
//     const skip = (page - 1) * limit;

//     const [products, total] = await Promise.all([
//       Product.find({ isActive: true }).skip(skip).limit(limit).lean(),
//       Product.countDocuments({ isActive: true }),
//     ]);

//     const formattedProducts = products.map(formatProductForShiprocket);

//     return res.status(200).json({
//       data: {
//         total,
//         page,
//         limit,
//         products: formattedProducts,
//       },
//     });
//   } catch (error) {
//     console.error("[Shiprocket API] Products Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

// // 2. Fetch Single Product
// const getShiprocketProductById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const targetNumericId = parseInt(id);

//     // Optimized: Find directly via database query instead of fetching all products into memory
//     const products = await Product.find({ isActive: true }).lean();
//     const product = products.find((p) => toNumericId(p._id) === targetNumericId);

//     if (!product) {
//       return res.status(404).json({ error: "Product not found" });
//     }

//     return res.status(200).json({
//       data: formatProductForShiprocket(product),
//     });
//   } catch (error) {
//     console.error("[Shiprocket API] Single Product Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

// // 3. Fetch Collections (Includes Total Count)
// const getShiprocketCollections = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 100;
//     const skip = (page - 1) * limit;

//     const [collections, total] = await Promise.all([
//       Collection.find({ isActive: true }).skip(skip).limit(limit).lean(),
//       Collection.countDocuments({ isActive: true }),
//     ]);

//     const formattedCollections = collections.map((col) => ({
//       id: toNumericId(col._id),
//       title: col.name,
//       handle: col.slug,
//       updated_at: col.updatedAt
//         ? new Date(col.updatedAt).toISOString()
//         : new Date().toISOString(),
//       body_html: col.description || "",
//       published_at: col.createdAt
//         ? new Date(col.createdAt).toISOString()
//         : new Date().toISOString(),
//       sort_order: "best-selling",
//       template_suffix: null,
//       products_count:
//         col.productCount || (col.products ? col.products.length : 0),
//     }));

//     return res.status(200).json({
//       data: {
//         total,
//         collections: formattedCollections,
//       },
//     });
//   } catch (error) {
//     console.error("[Shiprocket API] Collections Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

// // 4. Fetch Products by Collection (Includes Total Count & Pagination)
// const getShiprocketProductsByCollection = async (req, res) => {
//   try {
//     const { idOrSlug } = req.params;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 100;
//     const skip = (page - 1) * limit;

//     const collections = await Collection.find({ isActive: true }).lean();

//     // Find target collection by matching Numeric ID, ObjectId string, or Slug
//     const col = collections.find(
//       (c) =>
//         toNumericId(c._id) === parseInt(idOrSlug) ||
//         c._id.toString() === idOrSlug ||
//         c.slug === idOrSlug
//     );

//     if (!col) {
//       return res.status(404).json({ error: "Collection not found" });
//     }

//     const filter = { collection: col._id, isActive: true };

//     const [products, total] = await Promise.all([
//       Product.find(filter).skip(skip).limit(limit).lean(),
//       Product.countDocuments(filter),
//     ]);

//     const formattedProducts = products.map(formatProductForShiprocket);

//     return res.status(200).json({
//       data: {
//         total,
//         page,
//         limit,
//         products: formattedProducts,
//       },
//     });
//   } catch (error) {
//     console.error("[Shiprocket API] Collection Products Error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

// module.exports = {
//   getShiprocketProducts,
//   getShiprocketProductById,
//   getShiprocketCollections,
//   getShiprocketProductsByCollection,
// };

const Product = require("../../model/products/productModel");
const Collection = require("../../model/collection/collectionModel");
const toNumericId = require("../../utils/toNumericId");

/**
 * Parses options into key-value map or object format
 */
function parseOptions(options) {
  if (!options) return {};
  if (options instanceof Map) {
    return Object.fromEntries(options);
  }
  if (typeof options === "object") {
    return options;
  }
  return {};
}

/**
 * Formats options array required by Shiprocket: [{ name: "Color", values: [...] }]
 */
function formatOptionsForShiprocket(p) {
  if (p.options && Array.isArray(p.options) && p.options.length > 0) {
    return p.options.map((opt) => ({
      name: opt.name || "Option",
      values: Array.isArray(opt.values) ? opt.values : [opt.value || ""],
    }));
  }

  // Fallback: Infer options dynamically if variant options exist
  if (p.variants && p.variants.length > 0) {
    const optionMap = {};
    p.variants.forEach((v) => {
      const parsed = parseOptions(v.options);
      Object.keys(parsed).forEach((key) => {
        if (!optionMap[key]) optionMap[key] = new Set();
        optionMap[key].add(parsed[key]);
      });
    });

    return Object.keys(optionMap).map((key) => ({
      name: key,
      values: Array.from(optionMap[key]),
    }));
  }

  return [];
}

/**
 * Formats a single product document into Shiprocket's schema.
 */
function formatProductForShiprocket(p) {
  const primaryImageSrc =
    p.images && p.images.length > 0
      ? typeof p.images[0] === "string"
        ? p.images[0]
        : p.images[0].src || ""
      : p.image?.src || "";

  const hasVariants = p.variants && p.variants.length > 0;

  const variants = hasVariants
    ? p.variants.map((v) => {
        const variantImageSrc = v.image
          ? typeof v.image === "string"
            ? v.image
            : v.image.src
          : primaryImageSrc;

        return {
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
          grams: v.grams || (v.weight ? Math.round(v.weight * 1000) : 0),
          weight: v.weight || p.weight || 0.5,
          weight_unit: v.weightUnit || v.weight_unit || "kg",
          image: {
            src: variantImageSrc,
          },
          option_values: parseOptions(v.options),
        };
      })
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
          grams: p.grams || (p.weight ? Math.round(p.weight * 1000) : 500),
          weight: p.weight || 0.5,
          weight_unit: p.weightUnit || p.weight_unit || "kg",
          image: {
            src: primaryImageSrc,
          },
          option_values: {},
        },
      ];

  const imagesList = (p.images || []).map((img) => ({
    src: typeof img === "string" ? img : img.src,
    alt: typeof img === "object" && img.alt ? img.alt : p.name || "",
  }));

  return {
    id: toNumericId(p._id),
    title: p.name || "",
    body_html: p.longDescription || p.shortDescription || "<p></p>",
    vendor: p.vendor || "Rehnoor Jewels",
    product_type: p.category || "Jewelry",
    created_at: p.createdAt
      ? new Date(p.createdAt).toISOString()
      : new Date().toISOString(),
    handle: p.slug || "",
    updated_at: p.updatedAt
      ? new Date(p.updatedAt).toISOString()
      : new Date().toISOString(),
    tags: Array.isArray(p.seoKeywords) ? p.seoKeywords.join(", ") : p.tag || "",
    status: p.isActive ? "active" : "draft",
    variants: variants,
    options: formatOptionsForShiprocket(p),
    image: {
      src: primaryImageSrc,
    },
    images: imagesList,
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
    const targetNumericId = parseInt(id);

    const products = await Product.find({ isActive: true }).lean();
    const product = products.find(
      (p) => toNumericId(p._id) === targetNumericId,
    );

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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      Collection.find({ isActive: true }).skip(skip).limit(limit).lean(),
      Collection.countDocuments({ isActive: true }),
    ]);

    const formattedCollections = collections.map((col) => {
      const imageSrc =
        typeof col.image === "string" ? col.image : col.image?.src || "";

      return {
        id: toNumericId(col._id),
        updated_at: col.updatedAt
          ? new Date(col.updatedAt).toISOString()
          : new Date().toISOString(),
        body_html: col.description || "<p></p>",
        handle: col.slug || "",
        image: {
          src: imageSrc,
        },
        title: col.name || "",
        created_at: col.createdAt
          ? new Date(col.createdAt).toISOString()
          : new Date().toISOString(),
      };
    });

    return res.status(200).json({
      data: {
        total,
        collections: formattedCollections,
      },
    });
  } catch (error) {
    console.error("[Shiprocket API] Collections Error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// 4. Fetch Products by Collection
const getShiprocketProductsByCollection = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const collections = await Collection.find({ isActive: true }).lean();

    const col = collections.find(
      (c) =>
        toNumericId(c._id) === parseInt(idOrSlug) ||
        c._id.toString() === idOrSlug ||
        c.slug === idOrSlug,
    );

    if (!col) {
      return res.status(404).json({ error: "Collection not found" });
    }

    const filter = { collection: col._id, isActive: true };

    const [products, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    const formattedProducts = products.map(formatProductForShiprocket);

    return res.status(200).json({
      data: {
        total,
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
