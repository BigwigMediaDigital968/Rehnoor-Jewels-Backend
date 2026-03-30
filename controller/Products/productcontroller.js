const Product = require("../../model/products/productModel");
const Collection = require("../../model/collection/collectionModel");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isMongoId = (str) => /^[a-f\d]{24}$/i.test(str);

// Sync product into its collection's products array
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

// ─── PUBLIC ───────────────────────────────────────────────────────────────────

// GET /api/products — paginated, filterable list (public: isActive only)
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

    if (collection) filter.collection = collection;
    if (category) filter.category = { $regex: category, $options: "i" };
    if (tag) filter.tag = tag;
    if (featured === "true") filter.isFeatured = true;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [products, total] = await Promise.all([
      Product.find(filter)
        .select(
          "-careGuide -shippingOptions -shippingNote -returnNote -specifications -seoTitle -seoDescription -seoKeywords",
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

// GET /api/products/:idOrSlug — single product by _id OR slug (public)
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
    console.error("getPublicProductByIdOrSlug error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

// GET /api/admin/products — full list, all fields, including inactive
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

// GET /api/admin/products/:idOrSlug — single product (admin)
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
    console.error("adminGetProductByIdOrSlug error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/admin/products — create product
const createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);

    // Add to collection's products array if a collection was assigned
    if (product.collection) {
      await syncCollectionProducts(product.collection, product._id, "add");
    }

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
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
    console.error("createProduct error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PUT /api/admin/products/:id — full update
const updateProduct = async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const oldCollectionId = existing.collection?.toString();
    const newCollectionId = req.body.collection?.toString();

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("collection", "name slug label");

    // Handle collection change: remove from old, add to new
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

// PATCH /api/admin/products/:id/toggle — toggle isActive
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
    console.error("toggleProductStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/products/:id — delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }
    // Remove from collection
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

// DELETE /api/admin/products — bulk delete
const bulkDeleteProducts = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Provide an array of product IDs." });
    }

    // Fetch first to get collection refs for cleanup
    const products = await Product.find({ _id: { $in: ids } }).select(
      "collection",
    );
    const result = await Product.deleteMany({ _id: { $in: ids } });

    // Clean up collection references
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
      message: `${result.deletedCount} product(s) deleted.`,
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
