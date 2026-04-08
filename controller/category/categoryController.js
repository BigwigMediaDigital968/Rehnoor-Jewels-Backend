// controller/category/categoryController.js
// Complete Category + SubCategory controller for Rehnoor Jewels
// Admin: full CRUD, status toggle, product assignment, sub-category management
// Public: read-only active categories

const Category = require("../../model/category/categoryModel");
const { cloudinary } = require("../../config/cloudinary");

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Generate a URL-safe slug from a string
function generateSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Upload image to Cloudinary and return { url, publicId }
async function uploadToCloudinary(file, folder = "rehnoor/category") {
  const result = await cloudinary.uploader.upload(file.path, {
    folder,
    transformation: [
      { width: 800, height: 800, crop: "fill", quality: "auto" },
    ],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

// Delete image from Cloudinary
async function deleteFromCloudinary(publicId) {
  if (publicId) {
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — CATEGORY CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/categories
 * Create a new category
 */
exports.createCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      sortOrder,
      isFeatured,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    const slug = generateSlug(name);

    // Check duplicate
    const existing = await Category.findOne({ slug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A category with this name already exists",
      });
    }

    // Handle image upload
    let image = { url: "", publicId: "" };
    let bannerImage = { url: "", publicId: "" };

    if (req.files?.image?.[0]) {
      image = await uploadToCloudinary(req.files.image[0]);
    }
    if (req.files?.bannerImage?.[0]) {
      bannerImage = await uploadToCloudinary(
        req.files.bannerImage[0],
        "rehnoor/categories/banners",
      );
    }

    const category = await Category.create({
      name,
      slug,
      description,
      image,
      bannerImage,
      status: status || "active",
      sortOrder: sortOrder ? Number(sortOrder) : 0,
      isFeatured: isFeatured === "true" || isFeatured === true,
      metaTitle,
      metaDescription,
      createdBy: req.user?._id,
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: category,
    });
  } catch (error) {
    console.error("createCategory error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/categories
 * Get all categories (admin — includes inactive)
 */
exports.getAllCategoriesAdmin = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) filter.name = { $regex: search, $options: "i" };

    const skip = (Number(page) - 1) * Number(limit);

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("products", "name price images")
        .lean({ virtuals: true }),
      Category.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: categories,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/categories/:id
 * Get single category by ID (admin)
 */
exports.getCategoryByIdAdmin = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id)
      .populate("products", "name price images slug")
      .populate("subCategories.products", "name price images slug");

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/admin/categories/:id
 * Update a category
 */
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const {
      name,
      description,
      status,
      sortOrder,
      isFeatured,
      metaTitle,
      metaDescription,
    } = req.body;

    // Regenerate slug if name changed
    if (name && name !== category.name) {
      const newSlug = generateSlug(name);
      const conflict = await Category.findOne({
        slug: newSlug,
        _id: { $ne: category._id },
      });
      if (conflict) {
        return res.status(409).json({
          success: false,
          message: "A category with this name already exists",
        });
      }
      category.slug = newSlug;
      category.name = name;
    }

    // Handle image upload/replace
    if (req.files?.image?.[0]) {
      await deleteFromCloudinary(category.image?.publicId);
      category.image = await uploadToCloudinary(req.files.image[0]);
    }
    if (req.files?.bannerImage?.[0]) {
      await deleteFromCloudinary(category.bannerImage?.publicId);
      category.bannerImage = await uploadToCloudinary(
        req.files.bannerImage[0],
        "rehnoor/categories/banners",
      );
    }

    if (description !== undefined) category.description = description;
    if (status) category.status = status;
    if (sortOrder !== undefined) category.sortOrder = Number(sortOrder);
    if (isFeatured !== undefined)
      category.isFeatured = isFeatured === "true" || isFeatured === true;
    if (metaTitle !== undefined) category.metaTitle = metaTitle;
    if (metaDescription !== undefined)
      category.metaDescription = metaDescription;
    category.updatedBy = req.user?._id;

    await category.save();

    res.json({
      success: true,
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/admin/categories/:id
 * Delete a category (and its images from Cloudinary)
 */
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Delete images
    await deleteFromCloudinary(category.image?.publicId);
    await deleteFromCloudinary(category.bannerImage?.publicId);
    for (const sc of category.subCategories) {
      await deleteFromCloudinary(sc.image?.publicId);
    }

    await Category.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/admin/categories/:id/status
 * Toggle category status active ↔ inactive
 */
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    category.status = category.status === "active" ? "inactive" : "active";
    category.updatedBy = req.user?._id;
    await category.save();

    res.json({
      success: true,
      message: `Category marked as ${category.status}`,
      data: { status: category.status },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — SUB-CATEGORY CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/categories/:id/subcategories
 * Add a sub-category to a category
 */
exports.addSubCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const { name, description, status, sortOrder, metaTitle, metaDescription } =
      req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Sub-category name is required" });
    }

    const slug = generateSlug(name);

    // Check duplicate slug within this category
    const duplicate = category.subCategories.find((sc) => sc.slug === slug);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "Sub-category with this name already exists in this category",
      });
    }

    let image = { url: "", publicId: "" };
    if (req.files?.image?.[0]) {
      image = await uploadToCloudinary(
        req.files.image[0],
        "rehnoor/subcategories",
      );
    }

    category.subCategories.push({
      name,
      slug,
      description,
      image,
      status: status || "active",
      sortOrder: sortOrder ? Number(sortOrder) : category.subCategories.length,
      metaTitle,
      metaDescription,
    });

    await category.save();

    const newSubCat = category.subCategories[category.subCategories.length - 1];

    res.status(201).json({
      success: true,
      message: "Sub-category added successfully",
      data: newSubCat,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/admin/categories/:id/subcategories/:subId
 * Update a sub-category
 */
exports.updateSubCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const subCat = category.subCategories.id(req.params.subId);
    if (!subCat) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-category not found" });
    }

    const { name, description, status, sortOrder, metaTitle, metaDescription } =
      req.body;

    if (name && name !== subCat.name) {
      subCat.slug = generateSlug(name);
      subCat.name = name;
    }
    if (description !== undefined) subCat.description = description;
    if (status) subCat.status = status;
    if (sortOrder !== undefined) subCat.sortOrder = Number(sortOrder);
    if (metaTitle !== undefined) subCat.metaTitle = metaTitle;
    if (metaDescription !== undefined) subCat.metaDescription = metaDescription;

    if (req.files?.image?.[0]) {
      await deleteFromCloudinary(subCat.image?.publicId);
      subCat.image = await uploadToCloudinary(
        req.files.image[0],
        "rehnoor/subcategories",
      );
    }

    await category.save();

    res.json({
      success: true,
      message: "Sub-category updated successfully",
      data: subCat,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/admin/categories/:id/subcategories/:subId
 * Delete a sub-category
 */
exports.deleteSubCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const subCat = category.subCategories.id(req.params.subId);
    if (!subCat) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-category not found" });
    }

    await deleteFromCloudinary(subCat.image?.publicId);
    subCat.deleteOne();
    await category.save();

    res.json({ success: true, message: "Sub-category deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/admin/categories/:id/subcategories/:subId/status
 * Toggle sub-category status
 */
exports.toggleSubCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const subCat = category.subCategories.id(req.params.subId);
    if (!subCat) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-category not found" });
    }

    subCat.status = subCat.status === "active" ? "inactive" : "active";
    await category.save();

    res.json({
      success: true,
      message: `Sub-category marked as ${subCat.status}`,
      data: { status: subCat.status },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PRODUCT ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/admin/categories/:id/products
 * Assign products directly to a category
 * Body: { productIds: ["id1", "id2"] }
 */
exports.assignProductsToCategory = async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds)) {
      return res
        .status(400)
        .json({ success: false, message: "productIds array is required" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Add only unique IDs
    const existing = category.products.map((p) => p.toString());
    const toAdd = productIds.filter((id) => !existing.includes(id));
    category.products.push(...toAdd);
    await category.save();

    res.json({
      success: true,
      message: `${toAdd.length} product(s) assigned to category`,
      data: { totalProducts: category.products.length },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/admin/categories/:id/products/:productId
 * Remove a product from a category
 */
exports.removeProductFromCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    category.products = category.products.filter(
      (p) => p.toString() !== req.params.productId,
    );
    await category.save();

    res.json({ success: true, message: "Product removed from category" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/admin/categories/:id/subcategories/:subId/products
 * Assign products to a sub-category
 * Body: { productIds: ["id1", "id2"] }
 */
exports.assignProductsToSubCategory = async (req, res) => {
  try {
    const { productIds } = req.body;
    if (!productIds || !Array.isArray(productIds)) {
      return res
        .status(400)
        .json({ success: false, message: "productIds array is required" });
    }

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const subCat = category.subCategories.id(req.params.subId);
    if (!subCat) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-category not found" });
    }

    const existing = subCat.products.map((p) => p.toString());
    const toAdd = productIds.filter((id) => !existing.includes(id));
    subCat.products.push(...toAdd);
    await category.save();

    res.json({
      success: true,
      message: `${toAdd.length} product(s) assigned to sub-category`,
      data: { totalProducts: subCat.products.length },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/admin/categories/:id/subcategories/:subId/products/:productId
 * Remove a product from a sub-category
 */
exports.removeProductFromSubCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const subCat = category.subCategories.id(req.params.subId);
    if (!subCat) {
      return res
        .status(404)
        .json({ success: false, message: "Sub-category not found" });
    }

    subCat.products = subCat.products.filter(
      (p) => p.toString() !== req.params.productId,
    );
    await category.save();

    res.json({ success: true, message: "Product removed from sub-category" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — READ-ONLY (active only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/public/categories
 * Get all active categories with active sub-categories only
 */
exports.getPublicCategories = async (req, res) => {
  try {
    const categories = await Category.find({ status: "active" })
      .sort({ sortOrder: 1 })
      .select("-createdBy -updatedBy -bannerImage.publicId -image.publicId")
      .lean();

    // Filter out inactive subcategories for public view
    const filtered = categories.map((cat) => ({
      ...cat,
      subCategories: (cat.subCategories || [])
        .filter((sc) => sc.status === "active")
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/public/categories/:slug
 * Get a single active category by slug with products populated
 */
exports.getPublicCategoryBySlug = async (req, res) => {
  try {
    const category = await Category.findOne({
      slug: req.params.slug,
      status: "active",
    })
      .populate("products", "name price originalPrice images slug tag rating")
      .populate(
        "subCategories.products",
        "name price originalPrice images slug tag rating",
      )
      .lean();

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Filter inactive subcategories
    category.subCategories = (category.subCategories || []).filter(
      (sc) => sc.status === "active",
    );

    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/public/categories/featured
 * Get featured active categories for homepage
 */
exports.getFeaturedCategories = async (req, res) => {
  try {
    const categories = await Category.find({
      status: "active",
      isFeatured: true,
    })
      .sort({ sortOrder: 1 })
      .select("name slug image description subCategories")
      .lean();

    const filtered = categories.map((cat) => ({
      ...cat,
      subCategories: (cat.subCategories || []).filter(
        (sc) => sc.status === "active",
      ),
    }));

    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
