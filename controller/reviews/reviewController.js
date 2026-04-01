const Review = require("../../model/reviews/reviewModal");
const Product = require("../../model/products/productModel");

// ─── Helper: recalculate and save product rating ──────────────────────────────
async function recalculateProductRating(productId) {
  const result = await Review.aggregate([
    { $match: { product: productId, status: "approved" } },
    {
      $group: {
        _id: "$product",
        avgRating: { $avg: "$rating" },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const avg = result[0] ? Math.round(result[0].avgRating * 10) / 10 : 0;
  const count = result[0] ? result[0].reviewCount : 0;

  await Product.findByIdAndUpdate(productId, {
    rating: avg,
    reviewCount: count,
  });
}

// ─── Helper: destroy Cloudinary asset by URL ─────────────────────────────────
async function destroyCloudinaryAsset(url) {
  if (!url) return;
  try {
    const { cloudinary } = require("../../config/cloudinary");
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    const startIdx =
      uploadIdx + 1 < parts.length && /^v\d+$/.test(parts[uploadIdx + 1])
        ? uploadIdx + 2
        : uploadIdx + 1;
    const publicId = parts
      .slice(startIdx)
      .join("/")
      .replace(/\.[^/.]+$/, "");
    await cloudinary.uploader.destroy(publicId);
  } catch (e) {
    console.warn("Cloudinary destroy failed:", e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/reviews/:productIdOrSlug
// Returns only approved reviews for a product (what the website shows)
const getProductReviews = async (req, res) => {
  try {
    const { productIdOrSlug } = req.params;
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;

    // Resolve product
    const isId = /^[a-f\d]{24}$/i.test(productIdOrSlug);
    const query = isId ? { _id: productIdOrSlug } : { slug: productIdOrSlug };
    const product = await Product.findOne(query).select("_id name");
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const filter = { product: product._id, status: "approved" };
    const skip = (Number(page) - 1) * Number(limit);

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .select("-ipAddress -adminNote -approvedAt -rejectedAt")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments(filter),
    ]);

    // Rating breakdown
    const breakdown = await Review.aggregate([
      { $match: filter },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);
    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    breakdown.forEach(({ _id, count }) => {
      ratingBreakdown[_id] = count;
    });

    return res.status(200).json({
      success: true,
      data: reviews,
      ratingBreakdown,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getProductReviews error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/reviews/:productId
// Public: submit a review (goes to pending — requires admin approval)
const submitReview = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    }).select("_id");
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    const {
      rating,
      reviewTitle,
      reviewDescription,
      username,
      userCity,
      sizePurchased,
    } = req.body;

    // Build images from Cloudinary uploads
    const images = (req.files || []).map((file, i) => ({
      src: file.path,
      alt: `${username || "User"} review image ${i + 1}`,
    }));

    const review = await Review.create({
      product: productId,
      rating: Number(rating),
      reviewTitle,
      reviewDescription,
      username,
      userCity: userCity || "",
      sizePurchased: sizePurchased || "",
      images,
      status: "pending",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    });

    return res.status(201).json({
      success: true,
      message:
        "Thank you! Your review has been submitted and is pending approval.",
      data: {
        _id: review._id,
        reviewTitle: review.reviewTitle,
        status: review.status,
        createdAt: review.createdAt,
      },
    });
  } catch (error) {
    // Clean up uploaded images if review creation fails
    if (req.files?.length) {
      await Promise.allSettled(
        req.files.map((f) => destroyCloudinaryAsset(f.path)),
      );
    }
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    console.error("submitReview error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/reviews
// All reviews with filters (status, product, date range, search)
const adminGetAllReviews = async (req, res) => {
  try {
    const {
      status,
      product,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (product) filter.product = product;
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: "i" } },
        { reviewTitle: { $regex: search, $options: "i" } },
        { reviewDescription: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate("product", "name slug price")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Review.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetAllReviews error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/admin/reviews/stats
// Pending count + status breakdown for dashboard badge
const adminGetReviewStats = async (req, res) => {
  try {
    const breakdown = await Review.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const stats = { total: 0, pending: 0, approved: 0, rejected: 0 };
    breakdown.forEach(({ _id, count }) => {
      stats[_id] = count;
      stats.total += count;
    });
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("adminGetReviewStats error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/admin/reviews/:id
const adminGetReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate(
      "product",
      "name slug images price category purity",
    );
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }
    return res.status(200).json({ success: true, data: review });
  } catch (error) {
    console.error("adminGetReviewById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/reviews/:id/approve
// Approve review → recalculate product rating
const approveReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }
    if (review.status === "approved") {
      return res
        .status(400)
        .json({ success: false, message: "Review is already approved." });
    }

    review.status = "approved";
    review.approvedAt = new Date();
    review.rejectedAt = null;
    review.adminNote = req.body.adminNote || "";
    await review.save();

    // Recalculate product rating with the newly approved review included
    await recalculateProductRating(review.product);

    return res.status(200).json({
      success: true,
      message: "Review approved. Product rating updated.",
      data: review,
    });
  } catch (error) {
    console.error("approveReview error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/reviews/:id/reject
// Reject review → if it was previously approved, recalculate rating
const rejectReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }
    if (review.status === "rejected") {
      return res
        .status(400)
        .json({ success: false, message: "Review is already rejected." });
    }

    const wasApproved = review.status === "approved";

    review.status = "rejected";
    review.rejectedAt = new Date();
    review.approvedAt = null;
    review.adminNote = req.body.adminNote || "";
    await review.save();

    // Only recalculate if this review was contributing to the rating
    if (wasApproved) {
      await recalculateProductRating(review.product);
    }

    return res.status(200).json({
      success: true,
      message: "Review rejected.",
      data: review,
    });
  } catch (error) {
    console.error("rejectReview error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/reviews/:id/feature
// Toggle featured flag (pinned to top of review list)
const toggleFeaturedReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }
    review.isFeatured = !review.isFeatured;
    await review.save();
    return res.status(200).json({
      success: true,
      message: `Review ${review.isFeatured ? "featured" : "unfeatured"}.`,
      data: { _id: review._id, isFeatured: review.isFeatured },
    });
  } catch (error) {
    console.error("toggleFeaturedReview error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/reviews/:id
// Delete review + clean up Cloudinary images + recalculate product rating
const deleteReview = async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }

    // Clean up Cloudinary images
    if (review.images?.length) {
      await Promise.allSettled(
        review.images.map((img) => destroyCloudinaryAsset(img.src)),
      );
    }

    // Recalculate if it was approved
    if (review.status === "approved") {
      await recalculateProductRating(review.product);
    }

    return res
      .status(200)
      .json({ success: true, message: "Review deleted successfully." });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid review ID." });
    }
    console.error("deleteReview error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/reviews — bulk delete
const bulkDeleteReviews = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Provide an array of review IDs." });
    }

    const reviews = await Review.find({ _id: { $in: ids } });
    await Review.deleteMany({ _id: { $in: ids } });

    // Delete Cloudinary images
    await Promise.allSettled(
      reviews.flatMap((r) =>
        r.images.map((img) => destroyCloudinaryAsset(img.src)),
      ),
    );

    // Recalculate ratings for affected products (only those that had approved reviews)
    const productIds = [
      ...new Set(
        reviews
          .filter((r) => r.status === "approved")
          .map((r) => r.product.toString()),
      ),
    ];
    await Promise.allSettled(
      productIds.map((id) => recalculateProductRating(id)),
    );

    return res.status(200).json({
      success: true,
      message: `${reviews.length} review(s) deleted.`,
    });
  } catch (error) {
    console.error("bulkDeleteReviews error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  // Public
  getProductReviews,
  submitReview,
  // Admin
  adminGetAllReviews,
  adminGetReviewStats,
  adminGetReviewById,
  approveReview,
  rejectReview,
  toggleFeaturedReview,
  deleteReview,
  bulkDeleteReviews,
};
