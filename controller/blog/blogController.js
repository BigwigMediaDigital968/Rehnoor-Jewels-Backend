const Blog = require("../../model/blog/blogModel");

// ─── Helper: extract Cloudinary public_id from URL ────────────────────────────
function extractPublicId(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const idx = parts.indexOf("upload");
    const start =
      idx + 1 < parts.length && /^v\d+$/.test(parts[idx + 1])
        ? idx + 2
        : idx + 1;
    return parts
      .slice(start)
      .join("/")
      .replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
}

async function destroyCloudinaryAsset(url) {
  if (!url) return;
  const id = extractPublicId(url);
  if (!id) return;
  try {
    const { cloudinary } = require("../../config/cloudinary");
    await cloudinary.uploader.destroy(id);
  } catch (e) {
    console.warn("Cloudinary destroy failed:", id, e.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE IMAGE UPLOAD (called by Tiptap editor toolbar)
// POST /api/blogs/upload-image
// Returns: { success, url } — URL is inserted into HTML by editor
// ─────────────────────────────────────────────────────────────────────────────
const uploadContentImage = (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No image file provided." });
  }
  // req.file.path = Cloudinary secure URL (set by multer-storage-cloudinary)
  return res.status(200).json({
    success: true,
    url: req.file.path,
    message: "Image uploaded successfully.",
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/blogs — all published blogs (paginated, filterable)
const getPublishedBlogs = async (req, res) => {
  try {
    const {
      category,
      tag,
      search,
      featured,
      page = 1,
      limit = 10,
      sort = "-publishedAt",
    } = req.query;

    const filter = { status: "published" };
    if (category) filter.category = { $regex: category, $options: "i" };
    if (tag) filter.tags = tag;
    if (featured === "true") filter.isFeatured = true;
    if (search) filter.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .select(
          "title slug excerpt coverImage coverImageAlt category tags author.name publishedAt readingTimeMinutes views isFeatured",
        )
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Blog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getPublishedBlogs error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/blogs/:slug — single published blog (by slug, increments view count)
const getPublishedBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({
      slug: req.params.slug,
      status: "published",
    })
      .select("-contentImages -noIndex -noFollow -schemaMarkup")
      .populate(
        "relatedPosts",
        "title slug excerpt coverImage publishedAt readingTimeMinutes",
      );

    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found." });

    // Increment view count (fire-and-forget — don't await)
    Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } }).catch(() => {});

    return res.status(200).json({ success: true, data: blog });
  } catch (error) {
    console.error("getPublishedBlogBySlug error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/blogs/categories — distinct categories for nav/filter
const getBlogCategories = async (req, res) => {
  try {
    const categories = await Blog.distinct("category", {
      status: "published",
      category: { $ne: "" },
    });
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error("getBlogCategories error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/blogs — all blogs including drafts/archived (admin)
const adminGetAllBlogs = async (req, res) => {
  try {
    const {
      status,
      category,
      search,
      isFeatured,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (category) filter.category = { $regex: category, $options: "i" };
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { slug: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .select(
          "title slug status category tags author.name publishedAt readingTimeMinutes wordCount views isFeatured createdAt",
        )
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Blog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: blogs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetAllBlogs error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/admin/blogs/stats
const adminGetBlogStats = async (req, res) => {
  try {
    const [breakdown, topViewed] = await Promise.all([
      Blog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Blog.find({ status: "published" })
        .select("title slug views")
        .sort("-views")
        .limit(5),
    ]);
    const stats = {
      total: 0,
      draft: 0,
      published: 0,
      archived: 0,
      scheduled: 0,
    };
    breakdown.forEach(({ _id, count }) => {
      stats[_id] = count;
      stats.total += count;
    });
    return res
      .status(200)
      .json({ success: true, data: { ...stats, topViewed } });
  } catch (error) {
    console.error("adminGetBlogStats error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/admin/blogs/:id — single blog full (admin, works with draft too)
const adminGetBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate(
      "relatedPosts",
      "title slug",
    );
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found." });
    return res.status(200).json({ success: true, data: blog });
  } catch (error) {
    console.error("adminGetBlogById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/admin/blogs — create blog (with optional cover image)
const createBlog = async (req, res) => {
  try {
    const body = { ...req.body };

    // Parse JSON-encoded arrays from FormData
    if (typeof body.tags === "string")
      body.tags = JSON.parse(body.tags || "[]");
    if (typeof body.metaKeywords === "string")
      body.metaKeywords = JSON.parse(body.metaKeywords || "[]");
    if (typeof body.contentImages === "string")
      body.contentImages = JSON.parse(body.contentImages || "[]");
    if (typeof body.relatedPosts === "string")
      body.relatedPosts = JSON.parse(body.relatedPosts || "[]");
    if (typeof body.faqs === "string")
      body.faqs = JSON.parse(body.faqs || "[]");
    if (typeof body.author === "string")
      body.author = JSON.parse(body.author || "{}");

    // Booleans
    ["isFeatured", "noIndex", "noFollow"].forEach((k) => {
      if (body[k] !== undefined)
        body[k] = body[k] === "true" || body[k] === true;
    });

    // Cover image from multer (if uploaded as file)
    if (req.file) body.coverImage = req.file.path;

    const blog = await Blog.create(body);
    return res.status(201).json({
      success: true,
      message: "Blog created successfully.",
      data: blog,
    });
  } catch (error) {
    if (req.file) await destroyCloudinaryAsset(req.file.path);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    if (error.code === 11000)
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists." });
    console.error("createBlog error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PUT /api/admin/blogs/:id — full update
const updateBlog = async (req, res) => {
  try {
    const existing = await Blog.findById(req.params.id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found." });

    const body = { ...req.body };

    if (typeof body.tags === "string")
      body.tags = JSON.parse(body.tags || "[]");
    if (typeof body.metaKeywords === "string")
      body.metaKeywords = JSON.parse(body.metaKeywords || "[]");
    if (typeof body.contentImages === "string")
      body.contentImages = JSON.parse(body.contentImages || "[]");
    if (typeof body.relatedPosts === "string")
      body.relatedPosts = JSON.parse(body.relatedPosts || "[]");
    if (typeof body.faqs === "string")
      body.faqs = JSON.parse(body.faqs || "[]");
    if (typeof body.author === "string")
      body.author = JSON.parse(body.author || "{}");

    ["isFeatured", "noIndex", "noFollow"].forEach((k) => {
      if (body[k] !== undefined)
        body[k] = body[k] === "true" || body[k] === true;
    });

    // Cover image — replace if new file uploaded
    if (req.file) {
      if (existing.coverImage)
        await destroyCloudinaryAsset(existing.coverImage);
      body.coverImage = req.file.path;
    } else if (body.clearCoverImage === "true") {
      await destroyCloudinaryAsset(existing.coverImage);
      body.coverImage = "";
    }

    const blog = await Blog.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    return res.status(200).json({
      success: true,
      message: "Blog updated successfully.",
      data: blog,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    if (error.code === 11000)
      return res
        .status(409)
        .json({ success: false, message: "Slug already exists." });
    console.error("updateBlog error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/blogs/:id/publish — publish or unpublish
const togglePublish = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found." });

    const newStatus = blog.status === "published" ? "draft" : "published";
    blog.status = newStatus;
    if (newStatus === "published" && !blog.publishedAt)
      blog.publishedAt = new Date();
    await blog.save();

    return res.status(200).json({
      success: true,
      message: `Blog ${newStatus === "published" ? "published" : "unpublished"}.`,
      data: {
        _id: blog._id,
        status: blog.status,
        publishedAt: blog.publishedAt,
      },
    });
  } catch (error) {
    console.error("togglePublish error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/blogs/:id/status — set any status (draft / published / archived / scheduled)
const setBlogStatus = async (req, res) => {
  try {
    const { status, scheduledAt } = req.body;
    const VALID = ["draft", "published", "archived", "scheduled"];
    if (!VALID.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${VALID.join(", ")}`,
      });
    }

    const blog = await Blog.findById(req.params.id);
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found." });

    blog.status = status;
    if (status === "published" && !blog.publishedAt)
      blog.publishedAt = new Date();
    if (status === "scheduled" && scheduledAt)
      blog.scheduledAt = new Date(scheduledAt);
    await blog.save();

    return res.status(200).json({
      success: true,
      message: `Blog status set to "${status}".`,
      data: blog,
    });
  } catch (error) {
    console.error("setBlogStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/blogs/:id/feature — toggle featured flag
const toggleFeatured = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found." });
    blog.isFeatured = !blog.isFeatured;
    await blog.save();
    return res.status(200).json({
      success: true,
      message: `Blog ${blog.isFeatured ? "featured" : "unfeatured"}.`,
      data: { _id: blog._id, isFeatured: blog.isFeatured },
    });
  } catch (error) {
    console.error("toggleFeatured error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/blogs/:id — delete blog + Cloudinary cleanup
const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found." });

    // Delete cover image
    if (blog.coverImage) await destroyCloudinaryAsset(blog.coverImage);
    // Delete all inline content images
    if (blog.contentImages?.length) {
      await Promise.allSettled(blog.contentImages.map(destroyCloudinaryAsset));
    }

    return res
      .status(200)
      .json({ success: true, message: "Blog deleted successfully." });
  } catch (error) {
    if (error.name === "CastError")
      return res
        .status(400)
        .json({ success: false, message: "Invalid blog ID." });
    console.error("deleteBlog error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/blogs — bulk delete
const bulkDeleteBlogs = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Provide an array of blog IDs." });
    }

    const blogs = await Blog.find({ _id: { $in: ids } });
    await Blog.deleteMany({ _id: { $in: ids } });

    // Clean up Cloudinary assets
    await Promise.allSettled(
      blogs.flatMap((b) => [
        destroyCloudinaryAsset(b.coverImage),
        ...(b.contentImages || []).map(destroyCloudinaryAsset),
      ]),
    );

    return res
      .status(200)
      .json({ success: true, message: `${blogs.length} blog(s) deleted.` });
  } catch (error) {
    console.error("bulkDeleteBlogs error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  uploadContentImage,
  getPublishedBlogs,
  getPublishedBlogBySlug,
  getBlogCategories,
  adminGetAllBlogs,
  adminGetBlogStats,
  adminGetBlogById,
  createBlog,
  updateBlog,
  togglePublish,
  setBlogStatus,
  toggleFeatured,
  deleteBlog,
  bulkDeleteBlogs,
};
