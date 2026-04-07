const mongoose = require("mongoose");

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const ImageSchema = new mongoose.Schema(
  {
    src: { type: String, required: true },
    alt: { type: String, default: "" },
  },
  { _id: false },
);

const SizeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // '16"', 'S', '18', 'Free'
    available: { type: Boolean, default: true },
  },
  { _id: false },
);

const SpecificationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // "Metal", "Purity"
    value: { type: String, required: true }, // "22kt Yellow Gold"
    icon: { type: String, default: "" }, // optional icon name/emoji
  },
  { _id: false },
);

// ─── Main Product Schema ───────────────────────────────────────────────────────

const productSchema = new mongoose.Schema(
  {
    // ─── Identity ──────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [150, "Name cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9-]+$/,
        "Slug must be lowercase letters, numbers, and hyphens only",
      ],
    },
    subtitle: {
      type: String,
      trim: true,
      default: "", // "22kt Yellow Gold · 18 inch"
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true, // allows multiple nulls
    },

    // ─── Collection link ───────────────────────────────────────────
    collection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: "", // "Chains", "Rings" — denormalized for quick filter
    },

    // ─── Pricing ───────────────────────────────────────────────────
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    originalPrice: {
      type: Number,
      default: null, // if set, shows strikethrough + discount %
    },
    currency: {
      type: String,
      default: "INR",
    },

    // ─── Classification ────────────────────────────────────────────
    tag: {
      type: String,
      enum: [
        "Bestseller",
        "New",
        "Popular",
        "Limited",
        "Exclusive",
        "Trending",
        "Sale",
        "",
      ],
      default: "",
    },
    purity: {
      type: String,
      default: "22kt", // "22kt", "18kt", "24kt"
    },
    metal: {
      type: String,
      default: "Yellow Gold",
    },
    bisHallmark: {
      type: Boolean,
      default: true,
    },
    countryOfOrigin: {
      type: String,
      default: "Jaipur, India",
    },

    // ─── Content ───────────────────────────────────────────────────
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, "Short description cannot exceed 300 characters"],
      default: "",
    },
    longDescription: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── Our Promise (required) ────────────────────────────────────
    ourPromise: {
      type: String,
      required: [true, "ourPromise is required"],
      trim: true,
      // e.g. "We stand behind every piece we sell. 30-day returns, no questions asked."
    },

    // ─── Media ─────────────────────────────────────────────────────
    images: {
      type: [ImageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: "At least one product image is required",
      },
    },
    offerBannerImage: {
      type: String, // URL to a banner shown in product tabs
      default: "",
    },
    sizeChartImage: {
      type: String, // URL to size chart image
      default: "",
    },

    // ─── Variants ──────────────────────────────────────────────────
    sizes: {
      type: [SizeSchema],
      default: [],
    },
    weightGrams: {
      type: String,
      default: "", // "8–12 grams (size-dependent)"
    },

    // ─── Product Tabs data ─────────────────────────────────────────

    // Specifications tab — rendered as key/value table with optional icons
    specifications: {
      type: [SpecificationSchema],
      default: [],
    },

    // ─── SEO ───────────────────────────────────────────────────────
    seoTitle: { type: String, trim: true, default: "" },
    seoDescription: { type: String, trim: true, default: "" },
    seoKeywords: { type: [String], default: [] },

    // ─── Admin control ─────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true, // false = hidden from public
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    stock: {
      type: Number,
      default: null, // null = unlimited / not tracked
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────
// productSchema.index({ slug: 1 });
productSchema.index({ collection: 1, isActive: 1, sortOrder: 1 });
productSchema.index({ tag: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: "text", shortDescription: "text" }); // full-text search

// ─── Virtual: discount percentage ─────────────────────────────────
productSchema.virtual("discountPct").get(function () {
  if (!this.originalPrice || this.originalPrice <= this.price) return 0;
  return Math.round((1 - this.price / this.originalPrice) * 100);
});

// ─── Virtual: formatted price (for API convenience) ───────────────
productSchema.virtual("priceFormatted").get(function () {
  return `₹${this.price.toLocaleString("en-IN")}`;
});

productSchema.virtual("originalPriceFormatted").get(function () {
  if (!this.originalPrice) return null;
  return `₹${this.originalPrice.toLocaleString("en-IN")}`;
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
