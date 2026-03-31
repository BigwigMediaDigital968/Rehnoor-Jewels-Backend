const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const { config } = require("dotenv");
config("dotenv");

// ── Authenticate with Cloudinary ──────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Storage — images go to the "rehnoor/products" folder ─────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "rehnoor/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      { width: 1200, height: 1200, crop: "limit", quality: "auto:best" },
    ],
    // Stable public_id so re-uploads replace instead of duplicate
    public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
  }),
});

// ── Multer instance — max 8 images, 5 MB each ─────────────────────
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  //   fileFilter: (req, file, cb) => {
  //     if (file.mimetype.startsWith("image/")) return cb(null, true);
  //     cb(new Error("Only image files are allowed"), false);
  //   },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

    if (allowed.includes(file.mimetype)) {
      return cb(null, true);
    }

    console.log("Rejected file type:", file.mimetype); // debug
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  },
});

// module.exports = { cloudinary, upload };

const collectionStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "rehnoor/collections",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [
      // Hero images are wide banners — 1600×900 is more appropriate than square
      { width: 1600, height: 900, crop: "limit", quality: "auto:best" },
    ],
    public_id: `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}`,
  }),
});

const uploadCollection = multer({
  storage: collectionStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Invalid file type: ${file.mimetype}`), false);
  },
});

module.exports = { cloudinary, upload, uploadCollection };
