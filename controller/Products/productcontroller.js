// const Product = require("../../model/products/productModel");
// const Collection = require("../../model/collection/collectionModel");

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// const isMongoId = (str) => /^[a-f\d]{24}$/i.test(str);

// async function syncCollectionProducts(collectionId, productId, action = "add") {
//   if (!collectionId) return;
//   const update =
//     action === "add"
//       ? { $addToSet: { products: productId } }
//       : { $pull: { products: productId } };
//   const col = await Collection.findByIdAndUpdate(collectionId, update, {
//     new: true,
//   });
//   if (col) {
//     col.productCount = col.products.length;
//     await col.save();
//   }
// }

// function parseJsonField(raw) {
//   if (!raw) return null;
//   try {
//     return typeof raw === "string" ? JSON.parse(raw) : raw;
//   } catch {
//     return null;
//   }
// }

// // Extract Cloudinary public_id from a secure URL for deletion
// function extractPublicId(url) {
//   try {
//     const u = new URL(url);
//     const parts = u.pathname.split("/");
//     const uploadIdx = parts.indexOf("upload");
//     const startIdx =
//       uploadIdx + 1 < parts.length && /^v\d+$/.test(parts[uploadIdx + 1])
//         ? uploadIdx + 2
//         : uploadIdx + 1;
//     return parts
//       .slice(startIdx)
//       .join("/")
//       .replace(/\.[^/.]+$/, "");
//   } catch {
//     return null;
//   }
// }

// async function destroyCloudinaryAsset(url) {
//   if (!url) return;
//   const id = extractPublicId(url);
//   if (!id) return;
//   try {
//     const { cloudinary } = require("../../config/cloudinary");
//     await cloudinary.uploader.destroy(id);
//   } catch (e) {
//     console.warn("Cloudinary destroy failed:", id, e.message);
//   }
// }

// // ─── PUBLIC ───────────────────────────────────────────────────────────────────

// const getPublicProducts = async (req, res) => {
//   try {
//     const {
//       collection,
//       category,
//       tag,
//       search,
//       minPrice,
//       maxPrice,
//       featured,
//       page = 1,
//       limit = 12,
//       sort = "sortOrder",
//     } = req.query;

//     const filter = { isActive: true };
//     // if (collection) filter.collection = collection;
//     if (collection) {
//       const colDoc = await Collection.findOne({ slug: collection });

//       if (!colDoc) {
//         return res.status(200).json({
//           success: true,
//           data: [],
//           pagination: {
//             total: 0,
//             page: Number(page),
//             limit: Number(limit),
//             totalPages: 0,
//           },
//         });
//       }

//       filter.collection = colDoc._id; // ✅ FIX
//     }
//     if (category) filter.category = { $regex: category, $options: "i" };
//     if (tag) filter.tag = tag;
//     if (featured === "true") filter.isFeatured = true;
//     if (minPrice || maxPrice) {
//       filter.price = {};
//       if (minPrice) filter.price.$gte = Number(minPrice);
//       if (maxPrice) filter.price.$lte = Number(maxPrice);
//     }
//     if (search) filter.$text = { $search: search };

//     const skip = (Number(page) - 1) * Number(limit);
//     const [products, total] = await Promise.all([
//       Product.find(filter)
//         .select(
//           // Exclude admin/SEO-only fields from public response
//           "-specifications -seoTitle -seoDescription -seoKeywords",
//         )
//         .populate("collection", "name slug label")
//         .sort(sort)
//         .skip(skip)
//         .limit(Number(limit)),
//       Product.countDocuments(filter),
//     ]);

//     return res.status(200).json({
//       success: true,
//       data: products,
//       pagination: {
//         total,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(total / Number(limit)),
//       },
//     });
//   } catch (error) {
//     console.error("getPublicProducts error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// const getPublicProductByIdOrSlug = async (req, res) => {
//   try {
//     const { idOrSlug } = req.params;
//     const filter = isMongoId(idOrSlug)
//       ? { _id: idOrSlug, isActive: true }
//       : { slug: idOrSlug, isActive: true };

//     const product = await Product.findOne(filter).populate(
//       "collection",
//       "name slug label tag purity breadcrumb accentColor heroImage",
//     );
//     if (!product)
//       return res
//         .status(404)
//         .json({ success: false, message: "Product not found." });

//     return res.status(200).json({ success: true, data: product });
//   } catch (error) {
//     console.error("getPublicProductByIdOrSlug error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// // ─── ADMIN ────────────────────────────────────────────────────────────────────

// const adminGetAllProducts = async (req, res) => {
//   try {
//     const {
//       search,
//       collection,
//       isActive,
//       tag,
//       page = 1,
//       limit = 20,
//       sort = "-createdAt",
//     } = req.query;

//     const filter = {};
//     if (collection) filter.collection = collection;
//     if (tag) filter.tag = tag;
//     if (isActive !== undefined) filter.isActive = isActive === "true";
//     if (search) {
//       filter.$or = [
//         { name: { $regex: search, $options: "i" } },
//         { slug: { $regex: search, $options: "i" } },
//         { sku: { $regex: search, $options: "i" } },
//       ];
//     }

//     const skip = (Number(page) - 1) * Number(limit);
//     const [products, total, activeProducts] = await Promise.all([
//       Product.find(filter)
//         .populate("collection", "name slug")
//         .sort(sort)
//         .skip(skip)
//         .limit(Number(limit)),
//       Product.countDocuments(filter),
//       (isActive == undefined || isActive === "true")
//         ? Product.countDocuments({ ...filter, isActive: true })
//         : Promise.resolve(0),
//     ]);

//     return res.status(200).json({
//       success: true,
//       data: products,
//       pagination: {
//         total,
//         page: Number(page),
//         limit: Number(limit),
//         totalPages: Math.ceil(total / Number(limit)),
//         activeProducts: Number(activeProducts),
//       },
//     });
//   } catch (error) {
//     console.error("adminGetAllProducts error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// const adminGetProductByIdOrSlug = async (req, res) => {
//   try {
//     const { idOrSlug } = req.params;
//     const filter = isMongoId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };

//     const product = await Product.findOne(filter).populate(
//       "collection",
//       "name slug label",
//     );
//     if (!product)
//       return res
//         .status(404)
//         .json({ success: false, message: "Product not found." });

//     return res.status(200).json({ success: true, data: product });
//   } catch (error) {
//     console.error("adminGetProductByIdOrSlug error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// // ─── CREATE ───────────────────────────────────────────────────────────────────

// const createProduct = async (req, res) => {
//   try {
//     const body = { ...req.body };
//     const files = req.files || {}; // { images: [...], offerBanner: [...], sizeChart: [...] }

//     // ── Parse JSON-encoded array/object fields from FormData ───────────────
//     if (body.sizes) body.sizes = parseJsonField(body.sizes) ?? [];
//     if (body.specifications)
//       body.specifications = parseJsonField(body.specifications) ?? [];
//     if (body.seoKeywords)
//       body.seoKeywords = parseJsonField(body.seoKeywords) ?? [];

//     // ── Booleans arrive as strings from FormData ───────────────────────────
//     if (body.bisHallmark !== undefined)
//       body.bisHallmark = body.bisHallmark === "true";
//     if (body.isActive !== undefined) body.isActive = body.isActive === "true";
//     if (body.isFeatured !== undefined)
//       body.isFeatured = body.isFeatured === "true";

//     // ── Gallery images (files.images[]) ───────────────────────────────────
//     const existingImages = parseJsonField(body.existingImages) ?? [];
//     delete body.existingImages;

//     const newGalleryImages = (files.images || []).map((file, i) => ({
//       src: file.path,
//       alt: body.name
//         ? `${body.name} - view ${existingImages.length + i + 1}`
//         : file.originalname,
//     }));

//     body.images = [...existingImages, ...newGalleryImages];

//     // ── Offer banner (files.offerBanner[0]) ───────────────────────────────
//     if (files.offerBanner?.[0]) {
//       body.offerBannerImage = files.offerBanner[0].path;
//     }

//     // ── Size chart (files.sizeChart[0]) ───────────────────────────────────
//     if (files.sizeChart?.[0]) {
//       body.sizeChartImage = files.sizeChart[0].path;
//     }

//     const product = await Product.create(body);

//     if (product.collection) {
//       await syncCollectionProducts(product.collection, product._id, "add");
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Product created successfully.",
//       data: product,
//     });
//   } catch (error) {
//     // Clean up any Cloudinary uploads if Mongo save fails
//     const files = req.files || {};
//     const allUploaded = [
//       ...(files.images || []),
//       ...(files.offerBanner || []),
//       ...(files.sizeChart || []),
//     ];
//     if (allUploaded.length) {
//       await Promise.allSettled(
//         allUploaded.map((f) => destroyCloudinaryAsset(f.path)),
//       );
//     }

//     if (error.name === "ValidationError") {
//       const errors = Object.values(error.errors).map((e) => e.message);
//       return res
//         .status(400)
//         .json({ success: false, message: errors[0], errors });
//     }
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyPattern)[0];
//       return res
//         .status(409)
//         .json({ success: false, message: `${field} already exists.` });
//     }
//     console.error("createProduct error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// // ─── UPDATE ───────────────────────────────────────────────────────────────────

// const updateProduct = async (req, res) => {
//   try {
//     const existing = await Product.findById(req.params.id);
//     if (!existing)
//       return res
//         .status(404)
//         .json({ success: false, message: "Product not found." });

//     const body = { ...req.body };
//     const files = req.files || {};

//     // ── Parse JSON-encoded array/object fields from FormData ───────────────
//     if (body.sizes) body.sizes = parseJsonField(body.sizes) ?? [];
//     if (body.specifications)
//       body.specifications = parseJsonField(body.specifications) ?? [];
//     if (body.seoKeywords)
//       body.seoKeywords = parseJsonField(body.seoKeywords) ?? [];

//     // ── Booleans ──────────────────────────────────────────────────────────
//     if (body.bisHallmark !== undefined)
//       body.bisHallmark = body.bisHallmark === "true";
//     if (body.isActive !== undefined) body.isActive = body.isActive === "true";
//     if (body.isFeatured !== undefined)
//       body.isFeatured = body.isFeatured === "true";

//     // ── Gallery images ─────────────────────────────────────────────────────
//     const existingImages =
//       parseJsonField(body.existingImages) ?? existing.images;
//     delete body.existingImages;

//     const newGalleryImages = (files.images || []).map((file, i) => ({
//       src: file.path,
//       alt: body.name
//         ? `${body.name} - view ${existingImages.length + i + 1}`
//         : file.originalname,
//     }));

//     if (body.replaceImages === "true") {
//       // Delete all old gallery images from Cloudinary
//       await Promise.allSettled(
//         existing.images.map((img) => destroyCloudinaryAsset(img.src)),
//       );
//       body.images = newGalleryImages;
//     } else {
//       body.images = [...existingImages, ...newGalleryImages];
//     }
//     delete body.replaceImages;

//     // ── Offer banner ──────────────────────────────────────────────────────
//     if (files.offerBanner?.[0]) {
//       if (existing.offerBannerImage) {
//         await destroyCloudinaryAsset(existing.offerBannerImage);
//       }
//       body.offerBannerImage = files.offerBanner[0].path;
//     } else if (body.clearOfferBanner === "true") {
//       await destroyCloudinaryAsset(existing.offerBannerImage);
//       body.offerBannerImage = "";
//     }
//     delete body.clearOfferBanner;

//     // ── Size chart ────────────────────────────────────────────────────────
//     if (files.sizeChart?.[0]) {
//       if (existing.sizeChartImage) {
//         await destroyCloudinaryAsset(existing.sizeChartImage);
//       }
//       body.sizeChartImage = files.sizeChart[0].path;
//     } else if (body.clearSizeChart === "true") {
//       await destroyCloudinaryAsset(existing.sizeChartImage);
//       body.sizeChartImage = "";
//     }
//     delete body.clearSizeChart;

//     // ── Collection sync ───────────────────────────────────────────────────
//     const oldCollectionId = existing.collection?.toString();
//     const newCollectionId = body.collection?.toString();

//     const product = await Product.findByIdAndUpdate(req.params.id, body, {
//       new: true,
//       runValidators: true,
//     }).populate("collection", "name slug label");

//     if (oldCollectionId !== newCollectionId) {
//       if (oldCollectionId)
//         await syncCollectionProducts(oldCollectionId, product._id, "remove");
//       if (newCollectionId)
//         await syncCollectionProducts(newCollectionId, product._id, "add");
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Product updated successfully.",
//       data: product,
//     });
//   } catch (error) {
//     if (error.name === "ValidationError") {
//       const errors = Object.values(error.errors).map((e) => e.message);
//       return res
//         .status(400)
//         .json({ success: false, message: errors[0], errors });
//     }
//     if (error.code === 11000) {
//       const field = Object.keys(error.keyPattern)[0];
//       return res
//         .status(409)
//         .json({ success: false, message: `${field} already exists.` });
//     }
//     console.error("updateProduct error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// // ─── TOGGLE / DELETE ──────────────────────────────────────────────────────────

// const toggleProductStatus = async (req, res) => {
//   try {
//     const product = await Product.findById(req.params.id);
//     if (!product)
//       return res
//         .status(404)
//         .json({ success: false, message: "Product not found." });

//     product.isActive = !product.isActive;
//     await product.save();

//     return res.status(200).json({
//       success: true,
//       message: `Product ${product.isActive ? "activated" : "deactivated"}.`,
//       data: { _id: product._id, isActive: product.isActive },
//     });
//   } catch (error) {
//     console.error("toggleProductStatus error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// const deleteProduct = async (req, res) => {
//   try {
//     const product = await Product.findByIdAndDelete(req.params.id);
//     if (!product)
//       return res
//         .status(404)
//         .json({ success: false, message: "Product not found." });

//     // Clean up all Cloudinary assets
//     await Promise.allSettled([
//       ...product.images.map((img) => destroyCloudinaryAsset(img.src)),
//       destroyCloudinaryAsset(product.offerBannerImage),
//       destroyCloudinaryAsset(product.sizeChartImage),
//     ]);

//     if (product.collection) {
//       await syncCollectionProducts(product.collection, product._id, "remove");
//     }

//     return res
//       .status(200)
//       .json({ success: true, message: "Product deleted successfully." });
//   } catch (error) {
//     if (error.name === "CastError") {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid product ID." });
//     }
//     console.error("deleteProduct error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// const bulkDeleteProducts = async (req, res) => {
//   try {
//     const { ids } = req.body;
//     if (!Array.isArray(ids) || ids.length === 0) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Provide an array of product IDs." });
//     }

//     const products = await Product.find({ _id: { $in: ids } });
//     await Product.deleteMany({ _id: { $in: ids } });

//     // Wipe Cloudinary assets for all deleted products
//     await Promise.allSettled(
//       products.flatMap((p) => [
//         ...p.images.map((img) => destroyCloudinaryAsset(img.src)),
//         destroyCloudinaryAsset(p.offerBannerImage),
//         destroyCloudinaryAsset(p.sizeChartImage),
//       ]),
//     );

//     // Clean collection refs
//     const collectionIds = [
//       ...new Set(products.map((p) => p.collection?.toString()).filter(Boolean)),
//     ];
//     for (const colId of collectionIds) {
//       const deletedInCol = products
//         .filter((p) => p.collection?.toString() === colId)
//         .map((p) => p._id);
//       await Collection.findByIdAndUpdate(colId, {
//         $pull: { products: { $in: deletedInCol } },
//       });
//       const col = await Collection.findById(colId);
//       if (col) {
//         col.productCount = col.products.length;
//         await col.save();
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `${products.length} product(s) deleted.`,
//     });
//   } catch (error) {
//     console.error("bulkDeleteProducts error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };

// module.exports = {
//   getPublicProducts,
//   getPublicProductByIdOrSlug,
//   adminGetAllProducts,
//   adminGetProductByIdOrSlug,
//   createProduct,
//   updateProduct,
//   toggleProductStatus,
//   deleteProduct,
//   bulkDeleteProducts,
// };

const Product = require("../../model/products/productModel");
const Collection = require("../../model/collection/collectionModel");

// ─── Helpers ───────────────────────────────────────────────────────────────────

const isMongoId = (str) => /^[a-f\d]{24}$/i.test(str);

/** Parse a JSON-encoded field that arrives as a string (multipart/form-data). */
function parseJsonField(raw, fallback = null) {
  if (raw === undefined || raw === null) return fallback;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

/** Parse "true"/"false" strings from FormData into booleans. */
function parseBool(val, fallback) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === "boolean") return val;
  return val === "true";
}

/** Extract Cloudinary public_id from a secure_url for deletion. */
function extractPublicId(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const uploadAt = parts.indexOf("upload");
    const startAt =
      uploadAt + 1 < parts.length && /^v\d+$/.test(parts[uploadAt + 1])
        ? uploadAt + 2
        : uploadAt + 1;
    return parts
      .slice(startAt)
      .join("/")
      .replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

async function destroyCloudinaryAsset(url) {
  if (!url) return;
  const id = extractPublicId(url);
  if (!id) return;
  try {
    const { cloudinary } = require("../../config/cloudinary");
    await cloudinary.uploader.destroy(id);
  } catch (e) {
    console.warn("[Cloudinary] destroy failed:", id, e.message);
  }
}

/** Collect all Cloudinary URLs from a product document. */
function collectProductUrls(product) {
  return [
    ...product.images.map((img) => img.src),
    ...product.variants.flatMap((v) => v.images.map((img) => img.src)),
    product.offerBannerImage,
    product.sizeChartImage,
  ].filter(Boolean);
}

/**
 * Keep collection.products[] and productCount in sync.
 * Uses a single atomic update instead of find → mutate → save.
 */
async function syncCollection(collectionId, productId, action = "add") {
  if (!collectionId) return;

  const update =
    action === "add"
      ? { $addToSet: { products: productId } }
      : { $pull: { products: productId } };

  const col = await Collection.findByIdAndUpdate(collectionId, update, {
    new: true,
  });
  if (!col) return;

  await Collection.findByIdAndUpdate(collectionId, {
    $set: { productCount: col.products.length },
  });
}

/** Build a standardised error response. */
function handleMongoError(error, res) {
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: errors[0], errors });
  }
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return res
      .status(409)
      .json({ success: false, message: `${field} already exists.` });
  }
  if (error.name === "CastError") {
    return res
      .status(400)
      .json({ success: false, message: "Invalid ID format." });
  }
  console.error("[productController]", error);
  return res
    .status(500)
    .json({ success: false, message: "Internal server error." });
}

// ─── Variant helpers ───────────────────────────────────────────────────────────

/**
 * Merge variant images uploaded via multipart with existing/incoming variant data.
 *
 * req.files may contain keys like:
 *   variantImages_0   → images for variants[0]
 *   variantImages_1   → images for variants[1]
 *
 * @param {object[]} variants - parsed variant array from req.body
 * @param {object}   files    - req.files (multer field map)
 * @param {string}   productName
 */
function attachVariantImages(variants, files, productName = "") {
  return variants.map((variant, idx) => {
    const uploaded = files[`variantImages_${idx}`] || [];
    const incoming = uploaded.map((f, i) => ({
      src: f.path,
      alt: productName
        ? `${productName} - variant ${idx + 1} view ${(variant.images?.length ?? 0) + i + 1}`
        : f.originalname,
    }));
    return {
      ...variant,
      images: [...(variant.images ?? []), ...incoming],
    };
  });
}

/**
 * Delete Cloudinary assets for variant images that were removed during an update.
 * Compares existing variant images to the incoming set by variant _id.
 *
 * @param {object[]} existingVariants
 * @param {object[]} incomingVariants
 */
async function purgeRemovedVariantImages(existingVariants, incomingVariants) {
  const incomingMap = new Map(
    incomingVariants
      .filter((v) => v._id)
      .map((v) => [
        v._id.toString(),
        new Set((v.images ?? []).map((img) => img.src)),
      ]),
  );

  const toDestroy = [];

  for (const ev of existingVariants) {
    const id = ev._id.toString();
    const kept = incomingMap.get(id);

    if (!kept) {
      // Variant removed entirely — destroy all its images
      ev.images.forEach((img) => toDestroy.push(img.src));
    } else {
      // Variant retained — destroy only the images that were dropped
      ev.images
        .filter((img) => !kept.has(img.src))
        .forEach((img) => toDestroy.push(img.src));
    }
  }

  await Promise.allSettled(toDestroy.map(destroyCloudinaryAsset));
}

// ─── PUBLIC ────────────────────────────────────────────────────────────────────

const getPublicProducts = async (req, res) => {
  try {
    const {
      collection,
      category,
      tag,
      search,
      minPrice,
      maxPrice,
      featured,
      page = 1,
      limit = 12,
      sort = "sortOrder",
    } = req.query;

    const filter = { isActive: true };

    if (collection) {
      const colDoc = await Collection.findOne({ slug: collection }).lean();
      if (!colDoc) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { total: 0, page: +page, limit: +limit, totalPages: 0 },
        });
      }
      filter.collection = colDoc._id;
    }

    if (category) filter.category = { $regex: category, $options: "i" };
    if (tag) filter.tag = tag;
    if (featured === "true") filter.isFeatured = true;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = +minPrice;
      if (maxPrice) filter.price.$lte = +maxPrice;
    }

    if (search) filter.$text = { $search: search };

    const skip = (+page - 1) * +limit;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select("-specifications -seoTitle -seoDescription -seoKeywords")
        .populate("collection", "name slug label")
        .sort(sort)
        .skip(skip)
        .limit(+limit),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      },
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

const getPublicProductByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const filter = isMongoId(idOrSlug)
      ? { _id: idOrSlug, isActive: true }
      : { slug: idOrSlug, isActive: true };

    const product = await Product.findOne(filter).populate(
      "collection",
      "name slug label tag purity breadcrumb accentColor heroImage",
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

// ─── ADMIN — READ ──────────────────────────────────────────────────────────────

const adminGetAllProducts = async (req, res) => {
  try {
    const {
      search,
      collection,
      isActive,
      tag,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (collection) filter.collection = collection;
    if (tag) filter.tag = tag;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (+page - 1) * +limit;

    const [products, total, activeCount] = await Promise.all([
      Product.find(filter)
        .populate("collection", "name slug")
        .sort(sort)
        .skip(skip)
        .limit(+limit),
      Product.countDocuments(filter),
      isActive === "false"
        ? Promise.resolve(0)
        : Product.countDocuments({ ...filter, isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
        activeProducts: activeCount,
      },
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

const adminGetProductByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const filter = isMongoId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };

    const product = await Product.findOne(filter).populate(
      "collection",
      "name slug label",
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

// ─── CREATE ────────────────────────────────────────────────────────────────────

const createProduct = async (req, res) => {
  const files = req.files || {};
  const uploadedUrls = []; // track everything uploaded so we can roll back on failure

  // Collect a URL for potential rollback
  const track = (url) => {
    if (url) uploadedUrls.push(url);
    return url;
  };

  try {
    const body = { ...req.body };

    // ── Scalar booleans ────────────────────────────────────────────────────────
    body.isActive = parseBool(body.isActive, true);
    body.isFeatured = parseBool(body.isFeatured, false);

    // ── JSON-encoded array/object fields ───────────────────────────────────────
    body.specifications = parseJsonField(body.specifications, []);
    body.seoKeywords = parseJsonField(body.seoKeywords, []);
    body.options = parseJsonField(body.options, []);

    // ── Variants ───────────────────────────────────────────────────────────────
    let variants = parseJsonField(body.variants, []);
    variants = attachVariantImages(variants, files, body.name);
    body.variants = variants;

    // ── Gallery images ─────────────────────────────────────────────────────────
    const existingImages = parseJsonField(body.existingImages, []);
    delete body.existingImages;

    const newGallery = (files.images || []).map((f, i) => ({
      src: track(f.path),
      alt: body.name
        ? `${body.name} - view ${existingImages.length + i + 1}`
        : f.originalname,
    }));

    body.images = [...existingImages, ...newGallery];

    // ── Offer banner ───────────────────────────────────────────────────────────
    if (files.offerBanner?.[0]) {
      body.offerBannerImage = track(files.offerBanner[0].path);
    }

    // ── Size chart ─────────────────────────────────────────────────────────────
    if (files.sizeChart?.[0]) {
      body.sizeChartImage = track(files.sizeChart[0].path);
    }

    // ── Track variant image URLs ───────────────────────────────────────────────
    body.variants.forEach((v) => v.images?.forEach((img) => track(img.src)));

    const product = await Product.create(body);

    if (product.collection) {
      await syncCollection(product.collection, product._id, "add");
    }

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: product,
    });
  } catch (error) {
    // Roll back every Cloudinary asset uploaded in this request
    await Promise.allSettled(uploadedUrls.map(destroyCloudinaryAsset));
    return handleMongoError(error, res);
  }
};

// ─── UPDATE ────────────────────────────────────────────────────────────────────

const updateProduct = async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const body = { ...req.body };
    const files = req.files || {};

    // ── Scalar booleans ────────────────────────────────────────────────────────
    if (body.isActive !== undefined)
      body.isActive = parseBool(body.isActive, existing.isActive);
    if (body.isFeatured !== undefined)
      body.isFeatured = parseBool(body.isFeatured, existing.isFeatured);

    // ── JSON-encoded fields ────────────────────────────────────────────────────
    if (body.specifications !== undefined)
      body.specifications = parseJsonField(body.specifications, []);
    if (body.seoKeywords !== undefined)
      body.seoKeywords = parseJsonField(body.seoKeywords, []);
    if (body.options !== undefined)
      body.options = parseJsonField(body.options, []);

    // ── Variants ───────────────────────────────────────────────────────────────
    if (body.variants !== undefined) {
      let incomingVariants = parseJsonField(body.variants, []);
      incomingVariants = attachVariantImages(
        incomingVariants,
        files,
        body.name ?? existing.name,
      );

      // Clean up Cloudinary assets for removed/changed variant images
      await purgeRemovedVariantImages(existing.variants, incomingVariants);

      body.variants = incomingVariants;
    }

    // ── Gallery images ─────────────────────────────────────────────────────────
    const existingImages =
      body.existingImages !== undefined
        ? parseJsonField(body.existingImages, [])
        : existing.images;
    delete body.existingImages;

    const newGallery = (files.images || []).map((f, i) => ({
      src: f.path,
      alt:
        (body.name ?? existing.name)
          ? `${body.name ?? existing.name} - view ${existingImages.length + i + 1}`
          : f.originalname,
    }));

    if (body.replaceImages === "true") {
      await Promise.allSettled(
        existing.images.map((img) => destroyCloudinaryAsset(img.src)),
      );
      body.images = newGallery;
    } else {
      body.images = [...existingImages, ...newGallery];
    }
    delete body.replaceImages;

    // ── Offer banner ───────────────────────────────────────────────────────────
    if (files.offerBanner?.[0]) {
      await destroyCloudinaryAsset(existing.offerBannerImage);
      body.offerBannerImage = files.offerBanner[0].path;
    } else if (body.clearOfferBanner === "true") {
      await destroyCloudinaryAsset(existing.offerBannerImage);
      body.offerBannerImage = "";
    }
    delete body.clearOfferBanner;

    // ── Size chart ─────────────────────────────────────────────────────────────
    if (files.sizeChart?.[0]) {
      await destroyCloudinaryAsset(existing.sizeChartImage);
      body.sizeChartImage = files.sizeChart[0].path;
    } else if (body.clearSizeChart === "true") {
      await destroyCloudinaryAsset(existing.sizeChartImage);
      body.sizeChartImage = "";
    }
    delete body.clearSizeChart;

    // ── Collection sync ────────────────────────────────────────────────────────
    const oldColId = existing.collection?.toString();
    const newColId = body.collection?.toString();

    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    }).populate("collection", "name slug label");

    if (oldColId !== newColId) {
      await Promise.all([
        oldColId ? syncCollection(oldColId, product._id, "remove") : null,
        newColId ? syncCollection(newColId, product._id, "add") : null,
      ]);
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: product,
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

// ─── VARIANTS — granular sub-resource endpoints ────────────────────────────────

/** POST /products/:id/variants */
const addVariant = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const files = req.files || {};
    const variant = parseJsonField(req.body.variant, req.body);

    // Attach any uploaded images
    const [withImages] = attachVariantImages([variant], files, product.name);

    product.variants.push(withImages);
    await product.save();

    const added = product.variants[product.variants.length - 1];

    return res.status(201).json({
      success: true,
      message: "Variant added.",
      data: added,
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

/** PATCH /products/:id/variants/:variantId */
const updateVariant = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const variant = product.variants.id(req.params.variantId);
    if (!variant) {
      return res
        .status(404)
        .json({ success: false, message: "Variant not found." });
    }

    const files = req.files || {};
    const updates = parseJsonField(req.body.variant, req.body);

    // Merge uploaded images
    const [withImages] = attachVariantImages(
      [{ ...updates, images: variant.images }],
      files,
      product.name,
    );

    // If images were explicitly sent in the payload, reconcile
    if (updates.images !== undefined) {
      const incoming = parseJsonField(updates.images, variant.images);
      await purgeRemovedVariantImages(
        [variant],
        [{ _id: variant._id, images: incoming }],
      );
      withImages.images = [
        ...incoming,
        ...(files[`variantImages_0`] || []).map((f, i) => ({
          src: f.path,
          alt: `${product.name} - variant view ${incoming.length + i + 1}`,
        })),
      ];
    }

    // If this variant is being set as default, unset all others
    if (withImages.isDefault === true) {
      product.variants.forEach((v) => {
        v.isDefault = false;
      });
    }

    Object.assign(variant, withImages);
    await product.save();

    return res.status(200).json({
      success: true,
      message: "Variant updated.",
      data: variant,
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

/** DELETE /products/:id/variants/:variantId */
const deleteVariant = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const variant = product.variants.id(req.params.variantId);
    if (!variant) {
      return res
        .status(404)
        .json({ success: false, message: "Variant not found." });
    }

    // Destroy Cloudinary assets for this variant's images
    await Promise.allSettled(
      variant.images.map((img) => destroyCloudinaryAsset(img.src)),
    );

    variant.deleteOne();
    await product.save();

    return res.status(200).json({ success: true, message: "Variant deleted." });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

/** PATCH /products/:id/variants/:variantId/default — set a specific variant as default */
const setDefaultVariant = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const variant = product.variants.id(req.params.variantId);
    if (!variant) {
      return res
        .status(404)
        .json({ success: false, message: "Variant not found." });
    }

    product.variants.forEach((v) => {
      v.isDefault = false;
    });
    variant.isDefault = true;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Default variant updated.",
      data: { variantId: variant._id },
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

// ─── TOGGLE / DELETE ───────────────────────────────────────────────────────────

const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    product.isActive = !product.isActive;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? "activated" : "deactivated"}.`,
      data: { _id: product._id, isActive: product.isActive },
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    await Promise.allSettled(
      collectProductUrls(product).map(destroyCloudinaryAsset),
    );

    if (product.collection) {
      await syncCollection(product.collection, product._id, "remove");
    }

    return res
      .status(200)
      .json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a non-empty array of product IDs.",
      });
    }

    // Fetch first — we need the asset URLs before deleting
    const products = await Product.find({ _id: { $in: ids } });

    if (products.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No matching products found." });
    }

    // Delete from Mongo
    await Product.deleteMany({ _id: { $in: ids } });

    // Clean Cloudinary (fire-and-forget; logged internally)
    await Promise.allSettled(
      products.flatMap((p) =>
        collectProductUrls(p).map(destroyCloudinaryAsset),
      ),
    );

    // Sync every affected collection atomically
    const collectionGroups = products.reduce((acc, p) => {
      const colId = p.collection?.toString();
      if (!colId) return acc;
      if (!acc[colId]) acc[colId] = [];
      acc[colId].push(p._id);
      return acc;
    }, {});

    await Promise.all(
      Object.entries(collectionGroups).map(async ([colId, productIds]) => {
        const col = await Collection.findByIdAndUpdate(
          colId,
          { $pull: { products: { $in: productIds } } },
          { new: true },
        );
        if (col) {
          await Collection.findByIdAndUpdate(colId, {
            $set: { productCount: col.products.length },
          });
        }
      }),
    );

    return res.status(200).json({
      success: true,
      message: `${products.length} product(s) deleted.`,
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

// ─── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  // Public
  getPublicProducts,
  getPublicProductByIdOrSlug,

  // Admin — products
  adminGetAllProducts,
  adminGetProductByIdOrSlug,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
  bulkDeleteProducts,

  // Admin — variants
  addVariant,
  updateVariant,
  deleteVariant,
  setDefaultVariant,
};
