// const mongoose = require("mongoose");

// // ─── Sub-schemas ───────────────────────────────────────────────────────────────

// const ImageSchema = new mongoose.Schema(
//   {
//     src: { type: String, required: true },
//     alt: { type: String, default: "" },
//   },
//   { _id: false },
// );

// const SizeSchema = new mongoose.Schema(
//   {
//     label: { type: String, required: true }, // '16"', 'S', '18', 'Free'
//     available: { type: Boolean, default: true },
//   },
//   { _id: false },
// );

// const SpecificationSchema = new mongoose.Schema(
//   {
//     key: { type: String, required: true }, // "Metal", "Purity"
//     value: { type: String, required: true }, // "22kt Yellow Gold"
//     icon: { type: String, default: "" }, // optional icon name/emoji
//   },
//   { _id: false },
// );

// const ProductOptionSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       // required: true, // Size, Color, Purity
//     },

//     values: [
//       {
//         type: String, // S, M, L OR Yellow Gold
//       },
//     ],
//   },
//   { _id: false },
// );

// const ProductVariantSchema = new mongoose.Schema(
//   {
//     title: {
//       type: String,
//       default: "",
//       // "18 inch / Yellow Gold"
//     },

//     sku: {
//       type: String,
//       trim: true,
//       unique: true,
//       sparse: true,
//     },

//     barcode: {
//       type: String,
//       default: "",
//     },

//     price: {
//       type: Number,
//       required: true,
//     },

//     originalPrice: {
//       type: Number,
//       default: null,
//     },

//     stock: {
//       type: Number,
//       default: 0,
//     },

//     weightGrams: {
//       type: Number,
//       default: 0,
//     },

//     images: {
//       type: [ImageSchema],
//       default: [],
//     },

//     isDefault: {
//       type: Boolean,
//       default: false,
//     },

//     isActive: {
//       type: Boolean,
//       default: true,
//     },

//     options: {
//       type: Map,
//       of: String,

//       // Example:
//       // {
//       //   Size: "18 inch",
//       //   Color: "Rose Gold"
//       // }
//     },
//   },
//   {
//     _id: true,
//   },
// );

// // ─── Main Product Schema ───────────────────────────────────────────────────────

// const productSchema = new mongoose.Schema(
//   {
//     // ─── Identity ──────────────────────────────────────────────────
//     name: {
//       type: String,
//       required: [true, "Product name is required"],
//       trim: true,
//       maxlength: [150, "Name cannot exceed 150 characters"],
//     },
//     slug: {
//       type: String,
//       required: [true, "Slug is required"],
//       unique: true,
//       trim: true,
//       lowercase: true,
//       match: [
//         /^[a-z0-9-]+$/,
//         "Slug must be lowercase letters, numbers, and hyphens only",
//       ],
//     },
//     subtitle: {
//       type: String,
//       trim: true,
//       default: "", // "22kt Yellow Gold · 18 inch"
//     },
//     sku: {
//       type: String,
//       trim: true,
//       unique: true,
//       sparse: true, // allows multiple nulls
//     },

//     // ─── Collection link ───────────────────────────────────────────
//     collection: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Collection",
//       default: null,
//     },
//     category: {
//       type: String,
//       trim: true,
//       default: "", // "Chains", "Rings" — denormalized for quick filter
//     },

//     // ─── Pricing ───────────────────────────────────────────────────
//     price: {
//       type: Number,
//       required: [true, "Price is required"],
//       min: [0, "Price cannot be negative"],
//     },

//     originalPrice: {
//       type: Number,
//       default: null, // if set, shows strikethrough + discount %
//     },

//     currency: {
//       type: String,
//       default: "INR",
//     },

//     // ─── Classification ────────────────────────────────────────────
//     tag: {
//       type: String,
//       enum: [
//         "Bestseller",
//         "New",
//         "Popular",
//         "Limited",
//         "Exclusive",
//         "Trending",
//         "Sale",
//         "",
//       ],
//       default: "",
//     },

//     options: {
//       type: [ProductOptionSchema],
//       default: [],
//     },

//     variants: {
//       type: [ProductVariantSchema],
//       default: [],
//     },

//     // purity: {
//     //   type: String,
//     //   default: "22kt", // "22kt", "18kt", "24kt"
//     // },
//     // metal: {
//     //   type: String,
//     //   default: "Yellow Gold",
//     // },
//     // bisHallmark: {
//     //   type: Boolean,
//     //   default: true,
//     // },
//     // countryOfOrigin: {
//     //   type: String,
//     //   default: "Jaipur, India",
//     // },

//     // ─── Content ───────────────────────────────────────────────────
//     shortDescription: {
//       type: String,
//       trim: true,
//       maxlength: [300, "Short description cannot exceed 300 characters"],
//       default: "",
//     },
//     longDescription: {
//       type: String,
//       trim: true,
//       default: "",
//     },

//     // ─── Our Promise (required) ────────────────────────────────────
//     ourPromise: {
//       type: String,
//       required: [true, "ourPromise is required"],
//       trim: true,
//       // e.g. "We stand behind every piece we sell. 30-day returns, no questions asked."
//     },

//     // ─── Media ─────────────────────────────────────────────────────
//     images: {
//       type: [ImageSchema],
//       default: [],
//       validate: {
//         validator: (arr) => arr.length >= 1,
//         message: "At least one product image is required",
//       },
//     },
//     offerBannerImage: {
//       type: String, // URL to a banner shown in product tabs
//       default: "",
//     },
//     sizeChartImage: {
//       type: String, // URL to size chart image
//       default: "",
//     },

//     // ─── Variants ──────────────────────────────────────────────────
//     sizes: {
//       type: [SizeSchema],
//       default: [],
//     },
//     weightGrams: {
//       type: String,
//       default: "", // "8–12 grams (size-dependent)"
//     },

//     // ─── Product Tabs data ─────────────────────────────────────────

//     // Specifications tab — rendered as key/value table with optional icons
//     specifications: {
//       type: [SpecificationSchema],
//       default: [],
//     },

//     // ─── SEO ───────────────────────────────────────────────────────
//     seoTitle: { type: String, trim: true, default: "" },
//     seoDescription: { type: String, trim: true, default: "" },
//     seoKeywords: { type: [String], default: [] },

//     // ─── Admin control ─────────────────────────────────────────────
//     isActive: {
//       type: Boolean,
//       default: true, // false = hidden from public
//     },
//     isFeatured: {
//       type: Boolean,
//       default: false,
//     },
//     stock: {
//       type: Number,
//       default: null, // null = unlimited / not tracked
//     },
//     sortOrder: {
//       type: Number,
//       default: 0,
//     },
//   },
//   {
//     timestamps: true,
//   },
// );

// // ─── Indexes ──────────────────────────────────────────────────────
// // productSchema.index({ slug: 1 });
// productSchema.index({ collection: 1, isActive: 1, sortOrder: 1 });
// productSchema.index({ tag: 1, isActive: 1 });
// productSchema.index({ category: 1, isActive: 1 });
// productSchema.index({ name: "text", shortDescription: "text" }); // full-text search

// // ─── Virtual: discount percentage ─────────────────────────────────
// productSchema.virtual("discountPct").get(function () {
//   if (!this.originalPrice || this.originalPrice <= this.price) return 0;
//   return Math.round((1 - this.price / this.originalPrice) * 100);
// });

// // ─── Virtual: formatted price (for API convenience) ───────────────
// productSchema.virtual("priceFormatted").get(function () {
//   return `₹${this.price.toLocaleString("en-IN")}`;
// });

// productSchema.virtual("originalPriceFormatted").get(function () {
//   if (!this.originalPrice) return null;
//   return `₹${this.originalPrice.toLocaleString("en-IN")}`;
// });

// productSchema.set("toJSON", { virtuals: true });
// productSchema.set("toObject", { virtuals: true });

// module.exports = mongoose.model("Product", productSchema);

const mongoose = require("mongoose");

// ─── Sub-schemas ───────────────────────────────────────────────────────────────

const ImageSchema = new mongoose.Schema(
  {
    src: { type: String, required: true },
    alt: { type: String, default: "" },
  },
  { _id: false },
);

const SpecificationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    icon: { type: String, default: "" },
  },
  { _id: false },
);

/**
 * ProductOptionSchema
 * Defines the option axes available for this product.
 * e.g. { name: "Size", values: ["16\"", "18\"", "20\""] }
 *      { name: "Metal", values: ["Yellow Gold", "Rose Gold"] }
 */
const ProductOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    values: { type: [String], default: [] },
  },
  { _id: false },
);

/**
 * ProductVariantSchema
 * Each variant is a concrete, purchasable combination of option values.
 * options map keys MUST correspond to option names defined in product.options.
 *
 * e.g. options: { Size: "18\"", Metal: "Rose Gold" }
 */
const ProductVariantSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      default: "",
      // Auto-generated label: "18\" / Rose Gold" — set in pre-save or controller
    },
    sku: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: [true, "Variant price is required"],
      min: [0, "Variant price cannot be negative"],
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    stock: {
      type: Number,
      default: null, // null = unlimited
      min: [0, "Stock cannot be negative"],
    },
    weightGrams: {
      type: Number,
      default: 0,
      min: 0,
    },
    images: {
      type: [ImageSchema],
      default: [],
    },
    /**
     * Key-value map of option name → selected value.
     * Must align with parent product.options.
     * e.g. Map { "Size" => "18\"", "Metal" => "Rose Gold" }
     */
    options: {
      type: Map,
      of: String,
      default: {},
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true, timestamps: true },
);

// ─── Main Product Schema ───────────────────────────────────────────────────────

const productSchema = new mongoose.Schema(
  {
    // ─── Identity ──────────────────────────────────────────────────────────────
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
        "Slug must contain only lowercase letters, numbers, and hyphens",
      ],
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    // ─── Collection & Category ─────────────────────────────────────────────────
    collection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      default: null,
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── Pricing (base / no-variant fallback) ──────────────────────────────────
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    originalPrice: {
      type: Number,
      default: null,
    },
    currency: {
      type: String,
      default: "INR",
    },

    // ─── Classification ────────────────────────────────────────────────────────
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

    // ─── Variants & Options ────────────────────────────────────────────────────
    /**
     * options defines the axes (e.g. Size, Metal).
     * variants are the concrete combinations.
     * A product with no variants still has options: [] and variants: [].
     */
    options: {
      type: [ProductOptionSchema],
      default: [],
    },
    variants: {
      type: [ProductVariantSchema],
      default: [],
    },

    // ─── Content ───────────────────────────────────────────────────────────────
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
    ourPromise: {
      type: String,
      required: [true, "ourPromise is required"],
      trim: true,
    },

    // ─── Media ─────────────────────────────────────────────────────────────────
    images: {
      type: [ImageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: "At least one product image is required",
      },
    },
    offerBannerImage: {
      type: String,
      default: "",
    },
    sizeChartImage: {
      type: String,
      default: "",
    },

    // ─── Specifications ────────────────────────────────────────────────────────
    specifications: {
      type: [SpecificationSchema],
      default: [],
    },

    // ─── SEO ───────────────────────────────────────────────────────────────────
    seoTitle: { type: String, trim: true, default: "" },
    seoDescription: { type: String, trim: true, default: "" },
    seoKeywords: { type: [String], default: [] },

    // ─── Admin control ─────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    stock: {
      type: Number,
      default: null, // null = unlimited / not tracked; overridden by variant stock when variants exist
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
productSchema.index({ collection: 1, isActive: 1, sortOrder: 1 });
productSchema.index({ tag: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: "text", shortDescription: "text" });

// ─── Pre-save: enforce exactly one default variant ─────────────────────────────
productSchema.pre("save", async function () {
  if (!this.variants || this.variants.length === 0) {
    return;
  }

  const defaults = this.variants.filter((v) => v.isDefault);

  if (defaults.length === 0) {
    const first = this.variants.find((v) => v.isActive) ?? this.variants[0];

    first.isDefault = true;
  } else if (defaults.length > 1) {
    defaults.slice(0, -1).forEach((v) => {
      v.isDefault = false;
    });
  }
});

// ─── Virtuals ──────────────────────────────────────────────────────────────────
productSchema.virtual("discountPct").get(function () {
  if (!this.originalPrice || this.originalPrice <= this.price) return 0;
  return Math.round((1 - this.price / this.originalPrice) * 100);
});

productSchema.virtual("priceFormatted").get(function () {
  return `₹${this.price.toLocaleString("en-IN")}`;
});

productSchema.virtual("originalPriceFormatted").get(function () {
  if (!this.originalPrice) return null;
  return `₹${this.originalPrice.toLocaleString("en-IN")}`;
});

productSchema.virtual("hasVariants").get(function () {
  return this.variants && this.variants.length > 0;
});

productSchema.virtual("defaultVariant").get(function () {
  if (!this.variants || this.variants.length === 0) return null;
  return (
    this.variants.find((v) => v.isDefault && v.isActive) ?? this.variants[0]
  );
});

productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Product", productSchema);
