const mongoose = require("mongoose");

// ─── FAQ sub-schema ───────────────────────────────────────────────────────────
const FaqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 2000 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }, // keep _id so FAQs can be referenced individually
);

// ─── Author sub-schema ────────────────────────────────────────────────────────
const AuthorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    bio: { type: String, default: "", trim: true },
    avatar: { type: String, default: "" }, // Cloudinary URL
    email: { type: String, default: "", trim: true, lowercase: true },
  },
  { _id: false },
);

// ─── Main Blog Schema ─────────────────────────────────────────────────────────
const blogSchema = new mongoose.Schema(
  {
    // ─── Identity ──────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Blog title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
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

    // ─── Content ───────────────────────────────────────────────
    // Single field — stores Tiptap HTML output.
    // All inline images are already uploaded to Cloudinary and
    // their URLs are embedded inside the HTML by the editor.
    blogContent: {
      type: String,
      required: [true, "Blog content is required"],
      default: "",
    },

    // ─── Excerpt / summary ─────────────────────────────────────
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, "Excerpt cannot exceed 500 characters"],
      default: "",
      // If empty, auto-generated from blogContent on the frontend
    },

    // ─── Media ─────────────────────────────────────────────────
    coverImage: {
      type: String, // Cloudinary URL
      default: "",
    },
    coverImageAlt: {
      type: String,
      default: "",
    },
    // Additional images referenced inside blogContent are stored
    // here so they can be deleted from Cloudinary when the blog is deleted
    contentImages: {
      type: [String], // array of Cloudinary URLs
      default: [],
    },

    // ─── Categorisation ────────────────────────────────────────
    category: {
      type: String,
      trim: true,
      default: "", // "Jewellery Care", "Trends", "Behind the Scenes"
    },
    tags: {
      type: [String],
      default: [],
    },

    // ─── Author ────────────────────────────────────────────────
    author: {
      type: AuthorSchema,
      default: () => ({ name: "Rehnoor Team" }),
    },

    // ─── SEO — Meta fields ─────────────────────────────────────
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [70, "Meta title should be 70 characters or less"],
      default: "",
      // Falls back to title if empty on the frontend
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, "Meta description should be 160 characters or less"],
      default: "",
    },
    metaKeywords: {
      type: [String],
      default: [], // ["gold chain", "22kt jewellery", "buy gold online"]
    },

    // ─── SEO — Open Graph (social sharing) ─────────────────────
    ogTitle: {
      type: String,
      trim: true,
      default: "", // Falls back to metaTitle → title
    },
    ogDescription: {
      type: String,
      trim: true,
      maxlength: [200, "OG description should be 200 characters or less"],
      default: "",
    },
    ogImage: {
      type: String,
      default: "", // Falls back to coverImage
    },

    // ─── SEO — Canonical & Structured Data ─────────────────────
    canonicalUrl: {
      type: String,
      default: "", // Override if blog is published on multiple URLs
    },
    schemaMarkup: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // JSON-LD blob for Article / FAQPage schema
    },

    // ─── SEO — Technical ───────────────────────────────────────
    noIndex: {
      type: Boolean,
      default: false, // true = add noindex meta tag (for draft previews)
    },
    noFollow: {
      type: Boolean,
      default: false,
    },

    // ─── Reading estimate ──────────────────────────────────────
    readingTimeMinutes: {
      type: Number,
      default: null, // Auto-calculated before save (200 words/min)
    },
    wordCount: {
      type: Number,
      default: 0,
    },

    // ─── FAQs (separate from content — rendered as FAQ section) ─
    faqs: {
      type: [FaqSchema],
      default: [],
    },

    // ─── Publishing ────────────────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "published", "archived", "scheduled"],
      default: "draft",
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    scheduledAt: {
      type: Date,
      default: null, // When status = "scheduled", publish at this time
    },

    // ─── Engagement ────────────────────────────────────────────
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },

    // ─── Related posts ─────────────────────────────────────────
    relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Blog" }],

    // ─── Admin control ─────────────────────────────────────────
    isFeatured: { type: Boolean, default: false }, // shown on homepage / featured section
    sortOrder: { type: Number, default: 0 },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ isFeatured: 1, status: 1 });
blogSchema.index({ title: "text", excerpt: "text", metaKeywords: "text" });

// ─── Pre-save: auto-calculate word count + reading time ──────────────────────
blogSchema.pre("save", function (next) {
  if (this.isModified("blogContent") && this.blogContent) {
    // Strip HTML tags to count plain words
    const plain = this.blogContent
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = plain.split(" ").filter(Boolean).length;
    this.wordCount = words;
    this.readingTimeMinutes = Math.max(1, Math.ceil(words / 200));
  }

  // Auto-set publishedAt when status changes to published
  if (
    this.isModified("status") &&
    this.status === "published" &&
    !this.publishedAt
  ) {
    this.publishedAt = new Date();
  }

  next();
});

module.exports = mongoose.model("Blog", blogSchema);
