const mongoose = require("mongoose");

const collectionSchema = new mongoose.Schema(
  {
    // ─── Identity ─────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Collection name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
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

    // ─── Display (maps to CollectionMeta in frontend) ─────────────
    label: {
      type: String,
      required: [true, "Label is required"],
      trim: true,
    },
    tagline: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    heroImage: {
      type: String, // URL
      default: "",
    },
    accentColor: {
      type: String, // CSS color string e.g. "rgba(0,36,16,0.88)"
      default: "rgba(0,36,16,0.88)",
    },
    tag: {
      type: String,
      enum: [
        "Bestseller",
        "New",
        "Popular",
        "Limited",
        "Exclusive",
        "Trending",
        "Featured",
        "",
      ],
      default: "",
    },
    purity: {
      type: String,
      default: "22kt",
    },
    breadcrumb: {
      type: [String], // e.g. ["Home", "Collections", "Chains"]
      default: [],
    },

    // ─── Stats (computed on fetch, or stored for perf) ────────────
    productCount: {
      type: Number,
      default: 0,
    },

    // ─── SEO ──────────────────────────────────────────────────────
    seoTitle: { type: String, trim: true, default: "" },
    seoDescription: { type: String, trim: true, default: "" },
    seoKeywords: { type: [String], default: [] },

    // ─── Products in this collection ─────────────────────────────
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    // ─── Admin control ────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true, // false = hidden from public
    },
    sortOrder: {
      type: Number,
      default: 0, // lower = appears first
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────
// collectionSchema.index({ slug: 1 });
collectionSchema.index({ isActive: 1, sortOrder: 1 });

// ─── Auto-update productCount on save ─────────────────────────────
collectionSchema.pre("save", function (next) {
  this.productCount = this.products.length;
  // next();
});

module.exports = mongoose.model("Collection", collectionSchema);
