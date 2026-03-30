const Lead = require("../../model/Leads/LeadModel");

// ─────────────────────────────────────────────
// PUBLIC: Submit a new lead (contact form)
// POST /api/leads
// ─────────────────────────────────────────────
const submitLead = async (req, res) => {
  try {
    const { fullName, email, phone, subject, message } = req.body;

    const lead = await Lead.create({
      fullName,
      email,
      phone: phone || null,
      subject,
      message,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    });

    return res.status(201).json({
      success: true,
      message: "Your message has been received. We'll get back to you soon!",
      data: {
        id: lead._id,
        fullName: lead.fullName,
        email: lead.email,
        subject: lead.subject,
        createdAt: lead.createdAt,
      },
    });
  } catch (error) {
    // Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    console.error("submitLead error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error. Please try again." });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Get all leads with filters & pagination
// GET /api/leads?status=new&page=1&limit=20
// ─────────────────────────────────────────────
const getAllLeads = async (req, res) => {
  try {
    const {
      status,
      search,
      page = 1,
      limit = 20,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [leads, total] = await Promise.all([
      Lead.find(filter).sort(sort).skip(skip).limit(Number(limit)),
      Lead.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getAllLeads error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Get a single lead by ID
// GET /api/leads/:id
// ─────────────────────────────────────────────
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found." });
    }
    return res.status(200).json({ success: true, data: lead });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    }
    console.error("getLeadById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Update lead status
// PATCH /api/leads/:id/status
// Body: { status: "in-progress" | "resolved" | "spam" | "new", adminNotes?: "" }
// ─────────────────────────────────────────────
const updateLeadStatus = async (req, res) => {
  try {
    if (!req.body) {
      return res
        .status(400)
        .json({ success: false, message: "Request body is missing." });
    }

    const { status, adminNotes } = req.body;

    const allowedStatuses = ["new", "in-progress", "resolved", "spam"];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const update = { status };
    if (adminNotes !== undefined) update.adminNotes = adminNotes;
    if (status === "resolved") update.resolvedAt = new Date();

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true },
    );

    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found." });
    }

    return res.status(200).json({
      success: true,
      message: `Lead status updated to "${status}".`,
      data: lead,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    }
    console.error("updateLeadStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Delete a single lead
// DELETE /api/leads/:id
// ─────────────────────────────────────────────
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res
        .status(404)
        .json({ success: false, message: "Lead not found." });
    }
    return res
      .status(200)
      .json({ success: true, message: "Lead deleted successfully." });
  } catch (error) {
    if (error.name === "CastError") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID." });
    }
    console.error("deleteLead error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Bulk delete leads by IDs
// DELETE /api/leads
// Body: { ids: ["id1", "id2", ...] }
// ─────────────────────────────────────────────
const bulkDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Provide an array of lead IDs." });
    }

    const result = await Lead.deleteMany({ _id: { $in: ids } });

    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} lead(s) deleted successfully.`,
    });
  } catch (error) {
    console.error("bulkDeleteLeads error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────
// ADMIN: Get lead stats summary
// GET /api/leads/stats
// ─────────────────────────────────────────────
const getLeadStats = async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Lead.countDocuments();
    const summary = { total, new: 0, "in-progress": 0, resolved: 0, spam: 0 };
    stats.forEach(({ _id, count }) => {
      summary[_id] = count;
    });

    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    console.error("getLeadStats error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  submitLead,
  getAllLeads,
  getLeadById,
  updateLeadStatus,
  deleteLead,
  bulkDeleteLeads,
  getLeadStats,
};
