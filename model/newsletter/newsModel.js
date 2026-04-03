const mongoose = require("mongoose");

// ─── Subscriber Schema ────────────────────────────────────────────────────────

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    source: {
      type: String,
      enum: ["website", "admin", "import", "checkout", "other"],
      default: "website",
    },
    tags: {
      type: [String],
      default: [], // e.g. ["vip", "bridal", "new-arrival-interest"]
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed", "bounced", "complained"],
      default: "active",
    },
    // Brevo contact ID — set after syncing with Brevo
    brevoContactId: {
      type: Number,
      default: null,
    },
    // Unsubscribe token (unique per subscriber, used in unsubscribe links)
    unsubscribeToken: {
      type: String,
      default: () => require("crypto").randomBytes(24).toString("hex"),
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// subscriberSchema.index({ email: 1 });
subscriberSchema.index({ status: 1, subscribedAt: -1 });
subscriberSchema.index({ tags: 1 });
subscriberSchema.index({ unsubscribeToken: 1 });

// ─── Campaign Schema ──────────────────────────────────────────────────────────

const AttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true }, // Cloudinary URL
    publicId: { type: String, default: "" }, // Cloudinary public_id
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 }, // bytes
  },
  { _id: false },
);

const campaignSchema = new mongoose.Schema(
  {
    // ─── Identity ─────────────────────────────────────────────
    subject: {
      type: String,
      required: [true, "Email subject is required"],
      trim: true,
      maxlength: [300, "Subject cannot exceed 300 characters"],
    },
    previewText: {
      type: String,
      trim: true,
      default: "", // Gmail preview snippet
    },
    fromName: {
      type: String,
      trim: true,
      default: "Rehnoor Jewels",
    },
    fromEmail: {
      type: String,
      trim: true,
      default: process.env.BREVO_SENDER_EMAIL,
    },
    replyTo: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── Content ──────────────────────────────────────────────
    // Full HTML body of the email
    htmlContent: {
      type: String,
      required: [true, "Email HTML content is required"],
    },
    // Plain text fallback (auto-derived or manually set)
    textContent: {
      type: String,
      default: "",
    },

    // ─── Recipients ───────────────────────────────────────────
    recipientType: {
      type: String,
      enum: ["all", "selected", "tag"],
      default: "all",
    },
    // If recipientType === "selected": list of subscriber _ids
    selectedSubscriberIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Subscriber",
      default: [],
    },
    // If recipientType === "tag": filter by tag
    recipientTag: {
      type: String,
      default: "",
    },

    // ─── Attachments ──────────────────────────────────────────
    attachments: {
      type: [AttachmentSchema],
      default: [],
    },

    // ─── Status & send stats ──────────────────────────────────
    status: {
      type: String,
      enum: ["draft", "sending", "sent", "failed", "scheduled"],
      default: "draft",
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    totalRecipients: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },

    // ─── Brevo campaign ID (if created via Brevo API) ─────────
    brevoCampaignId: {
      type: Number,
      default: null,
    },

    // ─── Admin meta ───────────────────────────────────────────
    createdBy: {
      type: String,
      default: "admin",
    },
    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

campaignSchema.index({ status: 1, createdAt: -1 });

const Subscriber = mongoose.model("Subscriber", subscriberSchema);
const Campaign = mongoose.model("Campaign", campaignSchema);

module.exports = { Subscriber, Campaign };
