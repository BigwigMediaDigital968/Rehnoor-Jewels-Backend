const express = require("express");
const router = express.Router();
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../../config/cloudinary");
const { protect, adminOnly } = require("../../middleware/Authmiddleware");

const {
  subscribe,
  unsubscribe,
  adminGetSubscribers,
  adminGetSubscriberStats,
  adminAddSubscriber,
  adminUpdateSubscriber,
  adminDeleteSubscriber,
  adminBulkDeleteSubscribers,
  adminGetCampaigns,
  adminGetCampaignById,
  adminCreateCampaign,
  adminUpdateCampaign,
  adminDeleteCampaign,
  adminSendCampaign,
  adminSendTestEmail,
} = require("../../controller/news/newsController");

// ─── Multer storage for campaign attachments ──────────────────────────────────
// Files land in rehnoor/newsletter-attachments on Cloudinary
// We allow PDFs, images, and common document formats
const attachmentStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "rehnoor/newsletter-attachments",
    resource_type: "auto", // handles PDF, image, etc.
    public_id: `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
  }),
});

const uploadAttachments = multer({
  storage: attachmentStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (req, file, cb) => {
    const ALLOWED = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  },
});

const handleAttachmentUpload = (req, res, next) => {
  uploadAttachments.array("attachments", 5)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Attachment upload failed.",
      });
    }
    next();
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/newsletter/subscribe
router.post("/subscribe", subscribe);

// GET  /api/newsletter/unsubscribe?token=xxx
router.get("/unsubscribe", unsubscribe);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Subscribers
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/newsletter/admin/subscribers/stats
router.get(
  "/admin/subscribers/stats",
  protect,
  adminOnly,
  adminGetSubscriberStats,
);

// GET  /api/newsletter/admin/subscribers
router.get("/admin/subscribers", protect, adminOnly, adminGetSubscribers);

// POST /api/newsletter/admin/subscribers
router.post("/admin/subscribers", protect, adminOnly, adminAddSubscriber);

// PATCH /api/newsletter/admin/subscribers/bulk-delete
router.delete(
  "/admin/subscribers/bulk",
  protect,
  adminOnly,
  adminBulkDeleteSubscribers,
);

// PATCH /api/newsletter/admin/subscribers/:id
router.patch(
  "/admin/subscribers/:id",
  protect,
  adminOnly,
  adminUpdateSubscriber,
);

// DELETE /api/newsletter/admin/subscribers/:id
router.delete(
  "/admin/subscribers/:id",
  protect,
  adminOnly,
  adminDeleteSubscriber,
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Campaigns
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/newsletter/admin/campaigns
router.get("/admin/campaigns", protect, adminOnly, adminGetCampaigns);

// GET  /api/newsletter/admin/campaigns/:id
router.get("/admin/campaigns/:id", protect, adminOnly, adminGetCampaignById);

// POST /api/newsletter/admin/campaigns — create draft (with optional attachments)
router.post(
  "/admin/campaigns",
  protect,
  adminOnly,
  handleAttachmentUpload,
  adminCreateCampaign,
);

// PUT  /api/newsletter/admin/campaigns/:id — update draft (with optional new attachments)
router.put(
  "/admin/campaigns/:id",
  protect,
  adminOnly,
  handleAttachmentUpload,
  adminUpdateCampaign,
);

// DELETE /api/newsletter/admin/campaigns/:id
router.delete("/admin/campaigns/:id", protect, adminOnly, adminDeleteCampaign);

// POST /api/newsletter/admin/campaigns/:id/send — send to all/selected recipients
router.post("/admin/campaigns/:id/send", protect, adminOnly, adminSendCampaign);

// POST /api/newsletter/admin/campaigns/:id/test — send test email
router.post(
  "/admin/campaigns/:id/test",
  protect,
  adminOnly,
  adminSendTestEmail,
);

module.exports = router;
