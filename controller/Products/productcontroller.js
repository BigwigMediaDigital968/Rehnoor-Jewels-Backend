const Product = require("../../model/products/productModel");
const Collection = require("../../model/collection/collectionModel");
const ExcelJS = require("exceljs");
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

const getStats = async (req, res) => {
  try {
    const [products, active, outOfStock, collection, activeCollection] =
      await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ isActive: true }),

        // 2. Count out-of-stock products dynamically
        Product.countDocuments({
          $or: [
            // Case 1: Simple product with 0 stock
            { variants: { $size: 0 }, stock: 0 },
            // Case 2: Variant product where NO active variant has stock > 0 (or null)
            {
              variants: {
                $not: {
                  $elemMatch: {
                    isActive: true,
                    $or: [{ stock: null }, { stock: { $gt: 0 } }],
                  },
                },
              },
              "variants.0": { $exists: true }, // Must have at least one variant
            },
          ],
        }),

        Collection.countDocuments(),
        Collection.countDocuments({ isActive: true }),
      ]);

    return res.status(200).json({
      success: true,
      stats: {
        products: {
          all: products,
          active: active,
          outOfStock: outOfStock,
        },
        collection: {
          all: collection,
          active: activeCollection,
        },
      },
    });
  } catch (error) {
    return handleMongoError(error, res);
  }
};

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
      limit = 1000,
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

// Admin Export Products
const exportProductsExcel = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("collection", "name slug")
      .lean();

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Admin Panel";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Products");

    worksheet.columns = [
      { header: "Product Name", key: "name", width: 35 },
      { header: "Slug", key: "slug", width: 30 },
      { header: "SKU", key: "sku", width: 20 },
      { header: "Collection", key: "collection", width: 25 },
      { header: "Category", key: "category", width: 20 },
      { header: "Price", key: "price", width: 15 },
      { header: "Original Price", key: "originalPrice", width: 15 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Tag", key: "tag", width: 15 },
      { header: "Featured", key: "isFeatured", width: 12 },
      { header: "Active", key: "isActive", width: 12 },
      { header: "Stock", key: "stock", width: 12 },
      { header: "Variants", key: "variants", width: 12 },
      { header: "Created At", key: "createdAt", width: 25 },
    ];

    const headerRow = worksheet.getRow(1);

    headerRow.font = {
      bold: true,
      color: { argb: "FFFFFF" },
    };

    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1F2937" },
    };

    products.forEach((product) => {
      worksheet.addRow({
        name: product.name,
        slug: product.slug,
        sku: product.sku || "",
        collection: product.collection?.name || "",
        category: product.category || "",
        price: product.price || 0,
        originalPrice: product.originalPrice || "",
        currency: product.currency || "",
        tag: product.tag || "",
        isFeatured: product.isFeatured ? "Yes" : "No",
        isActive: product.isActive ? "Yes" : "No",
        stock:
          product.stock === undefined || product.stock === null
            ? "Unlimited"
            : product.stock,
        variants: product.variants?.length || 0,
        createdAt: product.createdAt
          ? new Date(product.createdAt).toLocaleString()
          : "",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=products-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);

    return res.end();
  } catch (error) {
    console.error("Export Products Error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to export products",
      });
    }
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
  getStats,
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

  // Excel Export
  exportProductsExcel,
};
