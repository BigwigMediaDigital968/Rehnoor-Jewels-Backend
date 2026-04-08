// model/category/categoryModel.js
// Full Category + SubCategory model for Rehnoor Jewels
// Supports: nested subcategories, product assignment, active/inactive status,
//           slug-based routing, image, sortOrder

const mongoose = require("mongoose");

// ─── SubCategory Schema (embedded) ───────────────────────────────────────────
const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Sub-category name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    // Products assigned to this sub-category
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
  },
  { timestamps: true },
);

// ─── Category Schema ──────────────────────────────────────────────────────────
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    bannerImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    // Direct products assigned to this category (not under any subcategory)
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    // Embedded sub-categories
    subCategories: [subCategorySchema],

    // SEO
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },

    // Created / updated by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
// Total product count across category + all subcategories
categorySchema.virtual("totalProductCount").get(function () {
  const direct = this.products ? this.products.length : 0;
  const sub = this.subCategories
    ? this.subCategories.reduce(
        (acc, sc) => acc + (sc.products ? sc.products.length : 0),
        0,
      )
    : 0;
  return direct + sub;
});

categorySchema.virtual("activeSubCategoryCount").get(function () {
  return this.subCategories
    ? this.subCategories.filter((sc) => sc.status === "active").length
    : 0;
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
// categorySchema.index({ slug: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ sortOrder: 1 });

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
