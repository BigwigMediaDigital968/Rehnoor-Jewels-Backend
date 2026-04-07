const Product = require("../../model/products/productModel");
const Collection = require("../../model/collection/collectionModel");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isMongoId = (str) => /^[a-f\d]{24}$/i.test(str);

async function syncCollectionProducts(collectionId, productId, action = "add") {
  if (!collectionId) return;
  const update =
    action === "add"
      ? { $addToSet: { products: productId } }
      : { $pull: { products: productId } };
  const col = await Collection.findByIdAndUpdate(collectionId, update, {
    new: true,
  });
  if (col) {
    col.productCount = col.products.length;
    await col.save();
  }
}

function parseJsonField(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

// Extract Cloudinary public_id from a secure URL for deletion
function extractPublicId(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    const startIdx =
      uploadIdx + 1 < parts.length && /^v\d+$/.test(parts[uploadIdx + 1])
        ? uploadIdx + 2
        : uploadIdx + 1;
    return parts
      .slice(startIdx)
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
    console.warn("Cloudinary destroy failed:", id, e.message);
  }
}

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

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
    // if (collection) filter.collection = collection;
    if (collection) {
      const colDoc = await Collection.findOne({ slug: collection });

      if (!colDoc) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: {
            total: 0,
            page: Number(page),
            limit: Number(limit),
            totalPages: 0,
          },
        });
      }

      filter.collection = colDoc._id; // ✅ FIX
    }
    if (category) filter.category = { $regex: category, $options: "i" };
    if (tag) filter.tag = tag;
    if (featured === "true") filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) filter.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select(
          // Exclude admin/SEO-only fields from public response
          "-specifications -seoTitle -seoDescription -seoKeywords",
        )
        .populate("collection", "name slug label")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getPublicProducts error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
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
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error("getPublicProductByIdOrSlug error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

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

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("collection", "name slug")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetAllProducts error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
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
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    console.error("adminGetProductByIdOrSlug error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────

const createProduct = async (req, res) => {
  try {
    const body = { ...req.body };
    const files = req.files || {}; // { images: [...], offerBanner: [...], sizeChart: [...] }

    // ── Parse JSON-encoded array/object fields from FormData ───────────────
    if (body.sizes) body.sizes = parseJsonField(body.sizes) ?? [];
    if (body.specifications)
      body.specifications = parseJsonField(body.specifications) ?? [];
    if (body.seoKeywords)
      body.seoKeywords = parseJsonField(body.seoKeywords) ?? [];

    // ── Booleans arrive as strings from FormData ───────────────────────────
    if (body.bisHallmark !== undefined)
      body.bisHallmark = body.bisHallmark === "true";
    if (body.isActive !== undefined) body.isActive = body.isActive === "true";
    if (body.isFeatured !== undefined)
      body.isFeatured = body.isFeatured === "true";

    // ── Gallery images (files.images[]) ───────────────────────────────────
    const existingImages = parseJsonField(body.existingImages) ?? [];
    delete body.existingImages;

    const newGalleryImages = (files.images || []).map((file, i) => ({
      src: file.path,
      alt: body.name
        ? `${body.name} - view ${existingImages.length + i + 1}`
        : file.originalname,
    }));

    body.images = [...existingImages, ...newGalleryImages];

    // ── Offer banner (files.offerBanner[0]) ───────────────────────────────
    if (files.offerBanner?.[0]) {
      body.offerBannerImage = files.offerBanner[0].path;
    }

    // ── Size chart (files.sizeChart[0]) ───────────────────────────────────
    if (files.sizeChart?.[0]) {
      body.sizeChartImage = files.sizeChart[0].path;
    }

    const product = await Product.create(body);

    if (product.collection) {
      await syncCollectionProducts(product.collection, product._id, "add");
    }

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: product,
    });
  } catch (error) {
    // Clean up any Cloudinary uploads if Mongo save fails
    const files = req.files || {};
    const allUploaded = [
      ...(files.images || []),
      ...(files.offerBanner || []),
      ...(files.sizeChart || []),
    ];
    if (allUploaded.length) {
      await Promise.allSettled(
        allUploaded.map((f) => destroyCloudinaryAsset(f.path)),
      );
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(409)
        .json({ success: false, message: `${field} already exists.` });
    }
    console.error("createProduct error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────

const updateProduct = async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });

    const body = { ...req.body };
    const files = req.files || {};

    // ── Parse JSON-encoded array/object fields from FormData ───────────────
    if (body.sizes) body.sizes = parseJsonField(body.sizes) ?? [];
    if (body.specifications)
      body.specifications = parseJsonField(body.specifications) ?? [];
    if (body.seoKeywords)
      body.seoKeywords = parseJsonField(body.seoKeywords) ?? [];

    // ── Booleans ──────────────────────────────────────────────────────────
    if (body.bisHallmark !== undefined)
      body.bisHallmark = body.bisHallmark === "true";
    if (body.isActive !== undefined) body.isActive = body.isActive === "true";
    if (body.isFeatured !== undefined)
      body.isFeatured = body.isFeatured === "true";

    // ── Gallery images ─────────────────────────────────────────────────────
    const existingImages =
      parseJsonField(body.existingImages) ?? existing.images;
    delete body.existingImages;

    const newGalleryImages = (files.images || []).map((file, i) => ({
      src: file.path,
      alt: body.name
        ? `${body.name} - view ${existingImages.length + i + 1}`
        : file.originalname,
    }));

    if (body.replaceImages === "true") {
      // Delete all old gallery images from Cloudinary
      await Promise.allSettled(
        existing.images.map((img) => destroyCloudinaryAsset(img.src)),
      );
      body.images = newGalleryImages;
    } else {
      body.images = [...existingImages, ...newGalleryImages];
    }
    delete body.replaceImages;

    // ── Offer banner ──────────────────────────────────────────────────────
    if (files.offerBanner?.[0]) {
      if (existing.offerBannerImage) {
        await destroyCloudinaryAsset(existing.offerBannerImage);
      }
      body.offerBannerImage = files.offerBanner[0].path;
    } else if (body.clearOfferBanner === "true") {
      await destroyCloudinaryAsset(existing.offerBannerImage);
      body.offerBannerImage = "";
    }
    delete body.clearOfferBanner;

    // ── Size chart ────────────────────────────────────────────────────────
    if (files.sizeChart?.[0]) {
      if (existing.sizeChartImage) {
        await destroyCloudinaryAsset(existing.sizeChartImage);
      }
      body.sizeChartImage = files.sizeChart[0].path;
    } else if (body.clearSizeChart === "true") {
      await destroyCloudinaryAsset(existing.sizeChartImage);
      body.sizeChartImage = "";
    }
    delete body.clearSizeChart;

    // ── Collection sync ───────────────────────────────────────────────────
    const oldCollectionId = existing.collection?.toString();
    const newCollectionId = body.collection?.toString();

    const product = await Product.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    }).populate("collection", "name slug label");

    if (oldCollectionId !== newCollectionId) {
      if (oldCollectionId)
        await syncCollectionProducts(oldCollectionId, product._id, "remove");
      if (newCollectionId)
        await syncCollectionProducts(newCollectionId, product._id, "add");
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(409)
        .json({ success: false, message: `${field} already exists.` });
    }
    console.error("updateProduct error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── TOGGLE / DELETE ──────────────────────────────────────────────────────────

const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });

    product.isActive = !product.isActive;
    await product.save();

    return res.status(200).json({
      success: true,
      message: `Product ${product.isActive ? "activated" : "deactivated"}.`,
      data: { _id: product._id, isActive: product.isActive },
    });
  } catch (error) {
    console.error("toggleProductStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product)
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });

    // Clean up all Cloudinary assets
    await Promise.allSettled([
      ...product.images.map((img) => destroyCloudinaryAsset(img.src)),
      destroyCloudinaryAsset(product.offerBannerImage),
      destroyCloudinaryAsset(product.sizeChartImage),
    ]);

    if (product.collection) {
      await syncCollectionProducts(product.collection, product._id, "remove");
    }

    return res
      .status(200)
      .json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product ID." });
    }
    console.error("deleteProduct error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Provide an array of product IDs." });
    }

    const products = await Product.find({ _id: { $in: ids } });
    await Product.deleteMany({ _id: { $in: ids } });

    // Wipe Cloudinary assets for all deleted products
    await Promise.allSettled(
      products.flatMap((p) => [
        ...p.images.map((img) => destroyCloudinaryAsset(img.src)),
        destroyCloudinaryAsset(p.offerBannerImage),
        destroyCloudinaryAsset(p.sizeChartImage),
      ]),
    );

    // Clean collection refs
    const collectionIds = [
      ...new Set(products.map((p) => p.collection?.toString()).filter(Boolean)),
    ];
    for (const colId of collectionIds) {
      const deletedInCol = products
        .filter((p) => p.collection?.toString() === colId)
        .map((p) => p._id);
      await Collection.findByIdAndUpdate(colId, {
        $pull: { products: { $in: deletedInCol } },
      });
      const col = await Collection.findById(colId);
      if (col) {
        col.productCount = col.products.length;
        await col.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: `${products.length} product(s) deleted.`,
    });
  } catch (error) {
    console.error("bulkDeleteProducts error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  getPublicProducts,
  getPublicProductByIdOrSlug,
  adminGetAllProducts,
  adminGetProductByIdOrSlug,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
  bulkDeleteProducts,
};
