const { upload, uploadCollection } = require("../config/cloudinary");

// ── Product images (existing) ──────────────────────────────────────
const uploadProductImages = upload.fields([
  { name: "images", maxCount: 8 },
  { name: "offerBanner", maxCount: 1 },
  { name: "sizeChart", maxCount: 1 },
]);

const handleImageUpload = (req, res, next) => {
  uploadProductImages(req, res, (err) => {
    if (err) {
      console.error("UPLOAD ERROR:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Image upload failed",
      });
    }
    next();
  });
};

// ── Collection hero image (single file under field "heroImage") ────
const uploadCollectionHero = uploadCollection.single("heroImage");

const handleCollectionImageUpload = (req, res, next) => {
  uploadCollectionHero(req, res, (err) => {
    if (err) {
      console.error("COLLECTION UPLOAD ERROR:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Hero image upload failed",
      });
    }
    next();
  });
};

// Review Images
const uploadReviewImages = upload.array("images", 5);

const handleReviewImageUpload = (req, res, next) => {
  uploadReviewImages(req, res, (err) => {
    if (err) {
      console.error("REVIEW UPLOAD ERROR:", err);
      return res.status(400).json({
        success: false,
        message: err.message || "Image upload failed",
      });
    }
    next();
  });
};

module.exports = {
  handleImageUpload,
  handleCollectionImageUpload,
  handleReviewImageUpload,
};
