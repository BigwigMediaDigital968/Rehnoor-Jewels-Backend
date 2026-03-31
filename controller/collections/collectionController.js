const Collection = require("../../model/collection/collectionModel");
const Product = require("../../model/products/productModel");

const isMongoId = (str) => /^[a-f\d]{24}$/i.test(str);

const safeParseArray = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    // Handle ['["a","b"]']
    if (value.length === 1 && typeof value[0] === "string") {
      try {
        return JSON.parse(value[0]);
      } catch {
        return value;
      }
    }
    return value;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(",").map((v) => v.trim());
    }
  }

  return [];
};

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// GET /api/collections — all active collections (public)
const getPublicCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ isActive: true })
      .select("-products -seoKeywords")
      .sort("sortOrder")
      .populate({
        path: "products",
        match: { isActive: true },
        select: "name slug images price tag rating",
      });

    return res.status(200).json({ success: true, data: collections });
  } catch (error) {
    console.error("getPublicCollections error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/collections/:idOrSlug — single collection with its active products (public)
const getPublicCollectionByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const filter = isMongoId(idOrSlug)
      ? { _id: idOrSlug, isActive: true }
      : { slug: idOrSlug, isActive: true };

    const collection = await Collection.findOne(filter).populate({
      path: "products",
      match: { isActive: true },
      select:
        "name slug subtitle images price originalPrice tag rating reviewCount sizes category purity",
      options: { sort: { sortOrder: 1 } },
    });

    collection.breadcrumb = safeParseArray(collection.breadcrumb);
    collection.seoKeywords = safeParseArray(collection.seoKeywords);

    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found." });
    }

    return res.status(200).json({ success: true, data: collection });
  } catch (error) {
    console.error("getPublicCollectionByIdOrSlug error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

// GET /api/admin/collections — all collections (admin)
const adminGetAllCollections = async (req, res) => {
  try {
    const {
      search,
      isActive,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [collections, total] = await Promise.all([
      Collection.find(filter).sort(sort).skip(skip).limit(Number(limit)),
      Collection.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: collections,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetAllCollections error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/admin/collections/:idOrSlug — single (admin, full data)
const adminGetCollectionByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const filter = isMongoId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };

    const collection = await Collection.findOne(filter).populate(
      "products",
      "name slug price isActive tag rating images",
    );
    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found." });
    }
    return res.status(200).json({ success: true, data: collection });
  } catch (error) {
    console.error("adminGetCollectionByIdOrSlug error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/admin/collections — create collection
const createCollection = async (req, res) => {
  try {
    let { products = [], breadcrumb, seoKeywords, ...rest } = req.body;

    breadcrumb = safeParseArray(breadcrumb);
    seoKeywords = safeParseArray(seoKeywords);
    products = safeParseArray(products);

    // ── If a hero image was uploaded, use its Cloudinary URL ──────
    if (req.file) {
      rest.heroImage = req.file.path; // Cloudinary secure URL
    }

    const collection = await Collection.create({
      ...rest,
      breadcrumb,
      seoKeywords,
      products,
      productCount: products.length,
    });

    if (products.length > 0) {
      await Product.updateMany(
        { _id: { $in: products } },
        { $set: { collection: collection._id } },
      );
    }

    return res.status(201).json({
      success: true,
      message: "Collection created successfully.",
      data: collection,
    });
  } catch (error) {
    // Clean up the uploaded Cloudinary asset if Mongo rejects the document
    if (req.file) {
      const { cloudinary } = require("../../config/cloudinary");
      await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists." });
    }
    console.error("createCollection error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PUT /api/admin/collections/:id — full update
// const updateCollection = async (req, res) => {
//   try {
//     const existing = await Collection.findById(req.params.id);
//     if (!existing) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Collection not found." });
//     }

//     const { products, ...rest } = req.body;

//     // Handle products array change
//     if (products !== undefined) {
//       const oldIds = existing.products.map((id) => id.toString());
//       const newIds = products.map((id) => id.toString());

//       const added = newIds.filter((id) => !oldIds.includes(id));
//       const removed = oldIds.filter((id) => !newIds.includes(id));

//       // Update back-references on Product
//       if (added.length > 0) {
//         await Product.updateMany(
//           { _id: { $in: added } },
//           { $set: { collection: existing._id } },
//         );
//       }
//       if (removed.length > 0) {
//         await Product.updateMany(
//           { _id: { $in: removed } },
//           { $set: { collection: null } },
//         );
//       }

//       rest.products = products;
//       rest.productCount = products.length;
//     }

//     const collection = await Collection.findByIdAndUpdate(req.params.id, rest, {
//       new: true,
//       runValidators: true,
//     }).populate("products", "name slug price isActive tag");

//     return res.status(200).json({
//       success: true,
//       message: "Collection updated successfully.",
//       data: collection,
//     });
//   } catch (error) {
//     if (error.name === "ValidationError") {
//       const errors = Object.values(error.errors).map((e) => e.message);
//       return res
//         .status(400)
//         .json({ success: false, message: errors[0], errors });
//     }
//     if (error.code === 11000) {
//       return res
//         .status(409)
//         .json({ success: false, message: "Slug already exists." });
//     }
//     console.error("updateCollection error:", error);
//     return res.status(500).json({ success: false, message: "Server error." });
//   }
// };
const updateCollection = async (req, res) => {
  try {
    const existing = await Collection.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found." });
    }

    let { products, breadcrumb, seoKeywords, ...rest } = req.body;

    breadcrumb = safeParseArray(breadcrumb);
    seoKeywords = safeParseArray(seoKeywords);

    // ── Inject new hero image URL if a file was uploaded ──────────
    if (req.file) {
      rest.heroImage = req.file.path;

      // Optionally delete the OLD hero from Cloudinary to save storage
      if (existing.heroImage) {
        try {
          const { cloudinary } = require("../../config/cloudinary");
          const url = new URL(existing.heroImage);
          const parts = url.pathname.split("/");
          const uploadIdx = parts.indexOf("upload");
          const startIdx =
            uploadIdx + 1 < parts.length && /^v\d+$/.test(parts[uploadIdx + 1])
              ? uploadIdx + 2
              : uploadIdx + 1;
          const publicId = parts
            .slice(startIdx)
            .join("/")
            .replace(/\.[^/.]+$/, "");
          await cloudinary.uploader.destroy(publicId);
        } catch {
          // Non-fatal — old image cleanup failing shouldn't block the update
        }
      }
    }

    // ── Handle products array change (existing logic preserved) ───
    if (products !== undefined) {
      let parsedProducts = products;

      // ✅ Convert string → array safely
      if (typeof products === "string") {
        try {
          parsedProducts = JSON.parse(products); // for JSON string
        } catch {
          // fallback: comma-separated string
          parsedProducts = products.split(",");
        }
      }

      // ✅ Ensure it's always an array
      if (!Array.isArray(parsedProducts)) {
        parsedProducts = [parsedProducts];
      }

      // ✅ Clean IDs
      const newIds = parsedProducts.map((id) => id.toString().trim());

      const oldIds = existing.products.map((id) => id.toString());

      const added = newIds.filter((id) => !oldIds.includes(id));
      const removed = oldIds.filter((id) => !newIds.includes(id));

      if (added.length > 0) {
        await Product.updateMany(
          { _id: { $in: added } },
          { $set: { collection: existing._id } },
        );
      }

      if (removed.length > 0) {
        await Product.updateMany(
          { _id: { $in: removed } },
          { $set: { collection: null } },
        );
      }

      rest.products = newIds;
      rest.productCount = newIds.length;
    }

    if (breadcrumb) rest.breadcrumb = breadcrumb;
    if (seoKeywords) rest.seoKeywords = seoKeywords;

    const collection = await Collection.findByIdAndUpdate(req.params.id, rest, {
      new: true,
      runValidators: true,
    }).populate("products", "name slug price isActive tag");

    return res.status(200).json({
      success: true,
      message: "Collection updated successfully.",
      data: collection,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists." });
    }
    console.error("updateCollection error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/collections/:id/toggle — toggle isActive
const toggleCollectionStatus = async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found." });
    }
    collection.isActive = !collection.isActive;
    await collection.save();
    return res.status(200).json({
      success: true,
      message: `Collection ${collection.isActive ? "activated" : "deactivated"}.`,
      data: { _id: collection._id, isActive: collection.isActive },
    });
  } catch (error) {
    console.error("toggleCollectionStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/collections/:id/products — assign/remove products
const manageCollectionProducts = async (req, res) => {
  try {
    const { action, productIds } = req.body;
    // action: "add" | "remove"
    if (
      !["add", "remove"].includes(action) ||
      !Array.isArray(productIds) ||
      productIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "action (add|remove) and productIds[] required.",
      });
    }

    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found." });
    }

    if (action === "add") {
      await Collection.findByIdAndUpdate(req.params.id, {
        $addToSet: { products: { $each: productIds } },
      });
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { collection: collection._id } },
      );
    } else {
      await Collection.findByIdAndUpdate(req.params.id, {
        $pull: { products: { $in: productIds } },
      });
      await Product.updateMany(
        { _id: { $in: productIds } },
        { $set: { collection: null } },
      );
    }

    const updated = await Collection.findByIdAndUpdate(
      req.params.id,
      {},
      { new: true },
    );
    updated.productCount = updated.products.length;
    await updated.save();

    return res.status(200).json({
      success: true,
      message: `${productIds.length} product(s) ${action === "add" ? "added to" : "removed from"} collection.`,
      data: { productCount: updated.productCount },
    });
  } catch (error) {
    console.error("manageCollectionProducts error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/collections/:id — delete collection
const deleteCollection = async (req, res) => {
  try {
    const collection = await Collection.findByIdAndDelete(req.params.id);
    if (!collection) {
      return res
        .status(404)
        .json({ success: false, message: "Collection not found." });
    }
    // Unlink all products
    if (collection.products.length > 0) {
      await Product.updateMany(
        { _id: { $in: collection.products } },
        { $set: { collection: null } },
      );
    }
    return res
      .status(200)
      .json({ success: true, message: "Collection deleted successfully." });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid collection ID." });
    }
    console.error("deleteCollection error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  getPublicCollections,
  getPublicCollectionByIdOrSlug,
  adminGetAllCollections,
  adminGetCollectionByIdOrSlug,
  createCollection,
  updateCollection,
  toggleCollectionStatus,
  manageCollectionProducts,
  deleteCollection,
};
