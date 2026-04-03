const { Subscriber, Campaign } = require("../../model/newsletter/newsModel");
const axios = require("axios");

// ─── Brevo helper ─────────────────────────────────────────────────────────────

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_BASE = "https://api.brevo.com/v3";

function brevoHeaders() {
  return {
    "api-key": BREVO_API_KEY,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// Sync a subscriber to Brevo contacts list
async function syncToBrevo(subscriber) {
  if (!BREVO_API_KEY) return;
  try {
    const payload = {
      email: subscriber.email,
      attributes: {
        FIRSTNAME: subscriber.name || "",
        UNSUBSCRIBE_TOKEN: subscriber.unsubscribeToken,
      },
      listIds: process.env.BREVO_LIST_ID
        ? [Number(process.env.BREVO_LIST_ID)]
        : [],
      updateEnabled: true,
    };
    const res = await axios.post(`${BREVO_BASE}/contacts`, payload, {
      headers: brevoHeaders(),
    });
    // res.data.id may or may not exist depending on if it's an update
    if (res.data?.id) {
      await Subscriber.findByIdAndUpdate(subscriber._id, {
        brevoContactId: res.data.id,
      });
    }
  } catch (err) {
    // Non-fatal — local record already saved
    console.error("Brevo sync error:", err?.response?.data || err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/newsletter/subscribe
const subscribe = async (req, res) => {
  try {
    const { email, name = "" } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });

    // Check if already subscribed
    const existing = await Subscriber.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existing) {
      if (existing.status === "active") {
        return res
          .status(200)
          .json({ success: true, message: "You're already subscribed!" });
      }
      // Re-subscribe (was unsubscribed before)
      existing.status = "active";
      existing.name = name || existing.name;
      existing.unsubscribedAt = null;
      await existing.save();
      await syncToBrevo(existing);
      return res.status(200).json({
        success: true,
        message: "Welcome back! You've been re-subscribed.",
      });
    }

    const subscriber = await Subscriber.create({
      email,
      name,
      source: "website",
      ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    });

    // Async Brevo sync — don't block response
    syncToBrevo(subscriber).catch(() => {});

    return res.status(201).json({
      success: true,
      message: "You've successfully subscribed to Rehnoor Jewels updates!",
      data: { email: subscriber.email },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(200)
        .json({ success: true, message: "You're already subscribed!" });
    }
    console.error("subscribe error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/newsletter/unsubscribe?token=xxx
const unsubscribe = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res
        .status(400)
        .json({ success: false, message: "Invalid unsubscribe link." });

    const subscriber = await Subscriber.findOne({ unsubscribeToken: token });
    if (!subscriber)
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found." });

    subscriber.status = "unsubscribed";
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    // Remove from Brevo list
    if (BREVO_API_KEY && subscriber.brevoContactId) {
      try {
        await axios.post(
          `${BREVO_BASE}/contacts/lists/${process.env.BREVO_LIST_ID}/contacts/remove`,
          { emails: [subscriber.email] },
          { headers: brevoHeaders() },
        );
      } catch {
        /* non-fatal */
      }
    }

    // Could redirect to a "you've been unsubscribed" page
    return res.status(200).json({
      success: true,
      message: "You have been unsubscribed successfully.",
    });
  } catch (error) {
    console.error("unsubscribe error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Subscribers
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/newsletter/admin/subscribers
const adminGetSubscribers = async (req, res) => {
  try {
    const {
      status,
      search,
      tag,
      source,
      page = 1,
      limit = 20,
      sort = "-subscribedAt",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (tag) filter.tags = tag;
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [subscribers, total] = await Promise.all([
      Subscriber.find(filter).sort(sort).skip(skip).limit(Number(limit)),
      Subscriber.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: subscribers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetSubscribers error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/newsletter/admin/subscribers/stats
const adminGetSubscriberStats = async (req, res) => {
  try {
    const [statusBreakdown, sourceBreakdown, total] = await Promise.all([
      Subscriber.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Subscriber.aggregate([
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
      Subscriber.countDocuments(),
    ]);

    const byStatus = {};
    statusBreakdown.forEach(({ _id, count }) => {
      byStatus[_id] = count;
    });
    const bySource = {};
    sourceBreakdown.forEach(({ _id, count }) => {
      bySource[_id] = count;
    });

    // Last 30 days new subs
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentCount = await Subscriber.countDocuments({
      subscribedAt: { $gte: since },
      status: "active",
    });

    return res.status(200).json({
      success: true,
      data: { total, byStatus, bySource, recentCount },
    });
  } catch (error) {
    console.error("adminGetSubscriberStats error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/newsletter/admin/subscribers — manually add subscriber
const adminAddSubscriber = async (req, res) => {
  try {
    const { email, name = "", tags = [] } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });

    const existing = await Subscriber.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Subscriber already exists." });
    }

    const subscriber = await Subscriber.create({
      email,
      name,
      tags,
      source: "admin",
    });
    syncToBrevo(subscriber).catch(() => {});

    return res
      .status(201)
      .json({ success: true, message: "Subscriber added.", data: subscriber });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ success: false, message: "Email already exists." });
    console.error("adminAddSubscriber error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/newsletter/admin/subscribers/:id — update tags / status
const adminUpdateSubscriber = async (req, res) => {
  try {
    const { status, tags, name } = req.body;
    const update = {};
    if (status) update.status = status;
    if (tags) update.tags = tags;
    if (name !== undefined) update.name = name;

    const subscriber = await Subscriber.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true },
    );
    if (!subscriber)
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found." });

    return res.status(200).json({
      success: true,
      message: "Subscriber updated.",
      data: subscriber,
    });
  } catch (error) {
    console.error("adminUpdateSubscriber error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/newsletter/admin/subscribers/:id
const adminDeleteSubscriber = async (req, res) => {
  try {
    const subscriber = await Subscriber.findByIdAndDelete(req.params.id);
    if (!subscriber)
      return res
        .status(404)
        .json({ success: false, message: "Subscriber not found." });
    return res
      .status(200)
      .json({ success: true, message: "Subscriber deleted." });
  } catch (error) {
    console.error("adminDeleteSubscriber error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/newsletter/admin/subscribers/bulk
const adminBulkDeleteSubscribers = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({
        success: false,
        message: "Provide an array of subscriber IDs.",
      });
    }
    const result = await Subscriber.deleteMany({ _id: { $in: ids } });
    return res.status(200).json({
      success: true,
      message: `${result.deletedCount} subscriber(s) deleted.`,
    });
  } catch (error) {
    console.error("adminBulkDeleteSubscribers error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — Campaigns
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/newsletter/admin/campaigns
const adminGetCampaigns = async (req, res) => {
  try {
    const { status, page = 1, limit = 15, sort = "-createdAt" } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .select("-htmlContent -textContent -selectedSubscriberIds")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Campaign.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: campaigns,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetCampaigns error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/newsletter/admin/campaigns/:id
const adminGetCampaignById = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id).populate(
      "selectedSubscriberIds",
      "email name",
    );
    if (!campaign)
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found." });
    return res.status(200).json({ success: true, data: campaign });
  } catch (error) {
    console.error("adminGetCampaignById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/newsletter/admin/campaigns — create/save campaign draft
// Uses multer for attachment uploads (multipart/form-data)
const adminCreateCampaign = async (req, res) => {
  try {
    const body = { ...req.body };

    // Parse JSON-encoded array fields (sent via FormData)
    if (typeof body.selectedSubscriberIds === "string") {
      try {
        body.selectedSubscriberIds = JSON.parse(body.selectedSubscriberIds);
      } catch {
        body.selectedSubscriberIds = [];
      }
    }

    // Build attachments array from multer-uploaded files
    const attachments = (req.files || []).map((file) => ({
      filename: file.originalname,
      url: file.path, // Cloudinary URL
      publicId: file.filename, // Cloudinary public_id
      mimeType: file.mimetype,
      size: file.size,
    }));

    const campaign = await Campaign.create({
      ...body,
      attachments,
      status: "draft",
    });

    return res.status(201).json({
      success: true,
      message: "Campaign saved as draft.",
      data: campaign,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    console.error("adminCreateCampaign error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PUT /api/newsletter/admin/campaigns/:id — update campaign (still draft)
const adminUpdateCampaign = async (req, res) => {
  try {
    const existing = await Campaign.findById(req.params.id);
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found." });
    if (existing.status === "sent") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot edit a sent campaign." });
    }

    const body = { ...req.body };
    if (typeof body.selectedSubscriberIds === "string") {
      try {
        body.selectedSubscriberIds = JSON.parse(body.selectedSubscriberIds);
      } catch {
        body.selectedSubscriberIds = [];
      }
    }

    // Merge new attachments with existing ones
    const newAttachments = (req.files || []).map((file) => ({
      filename: file.originalname,
      url: file.path,
      publicId: file.filename,
      mimeType: file.mimetype,
      size: file.size,
    }));

    // Keep existing attachments unless client sends replaceAttachments=true
    const existingAttachments =
      body.replaceAttachments === "true" ? [] : existing.attachments;
    delete body.replaceAttachments;

    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { ...body, attachments: [...existingAttachments, ...newAttachments] },
      { new: true, runValidators: true },
    );

    return res
      .status(200)
      .json({ success: true, message: "Campaign updated.", data: campaign });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    console.error("adminUpdateCampaign error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/newsletter/admin/campaigns/:id
const adminDeleteCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndDelete(req.params.id);
    if (!campaign)
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found." });
    return res
      .status(200)
      .json({ success: true, message: "Campaign deleted." });
  } catch (error) {
    console.error("adminDeleteCampaign error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND — via Brevo Transactional Email API
// POST /api/newsletter/admin/campaigns/:id/send
// ─────────────────────────────────────────────────────────────────────────────
const adminSendCampaign = async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign)
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found." });
    if (campaign.status === "sent")
      return res
        .status(400)
        .json({ success: false, message: "Campaign already sent." });
    if (campaign.status === "sending")
      return res
        .status(400)
        .json({ success: false, message: "Campaign is already sending." });

    if (!BREVO_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Brevo API key not configured. Set BREVO_API_KEY in .env",
      });
    }

    // ── Resolve recipients ─────────────────────────────────────────────────
    let recipients = [];

    if (campaign.recipientType === "all") {
      recipients = await Subscriber.find({ status: "active" }).select(
        "email name",
      );
    } else if (campaign.recipientType === "tag" && campaign.recipientTag) {
      recipients = await Subscriber.find({
        status: "active",
        tags: campaign.recipientTag,
      }).select("email name");
    } else if (
      campaign.recipientType === "selected" &&
      campaign.selectedSubscriberIds?.length
    ) {
      recipients = await Subscriber.find({
        _id: { $in: campaign.selectedSubscriberIds },
        status: "active",
      }).select("email name");
    }

    if (!recipients.length) {
      return res.status(400).json({
        success: false,
        message: "No active recipients found for this campaign.",
      });
    }

    // Mark as sending immediately so duplicate sends are prevented
    campaign.status = "sending";
    campaign.totalRecipients = recipients.length;
    await campaign.save();

    // ── Build Brevo payload ────────────────────────────────────────────────
    // We use the /smtp/email transactional endpoint (batch with to array)
    // Brevo limits: 200 recipients per call — chunk if needed
    const CHUNK_SIZE = 200;
    let successCount = 0;
    let failureCount = 0;

    // Build attachment array for Brevo (base64 not needed — Brevo accepts URL attachments)
    const brevoAttachments = campaign.attachments.map((att) => ({
      name: att.filename,
      url: att.url, // Brevo fetches attachments from URLs
    }));

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);

      const payload = {
        sender: {
          name: campaign.fromName || "Rehnoor Jewels",
          email: campaign.fromEmail || process.env.BREVO_SENDER_EMAIL,
        },
        to: chunk.map((r) => ({ email: r.email, name: r.name || r.email })),
        ...(campaign.replyTo ? { replyTo: { email: campaign.replyTo } } : {}),
        subject: campaign.subject,
        htmlContent: campaign.htmlContent,
        ...(campaign.textContent ? { textContent: campaign.textContent } : {}),
        ...(brevoAttachments.length ? { attachment: brevoAttachments } : {}),
        headers: {
          "X-Campaign-Id": String(campaign._id),
        },
      };

      try {
        await axios.post(`${BREVO_BASE}/smtp/email`, payload, {
          headers: brevoHeaders(),
        });
        successCount += chunk.length;
      } catch (err) {
        console.error(
          `Brevo send error for chunk ${i}:`,
          err?.response?.data || err.message,
        );
        failureCount += chunk.length;
      }
    }

    // Update campaign status
    campaign.status = failureCount === recipients.length ? "failed" : "sent";
    campaign.sentAt = new Date();
    campaign.successCount = successCount;
    campaign.failureCount = failureCount;
    await campaign.save();

    return res.status(200).json({
      success: true,
      message: `Campaign sent to ${successCount} of ${recipients.length} recipients.`,
      data: {
        totalRecipients: recipients.length,
        successCount,
        failureCount,
        status: campaign.status,
      },
    });
  } catch (error) {
    // Revert status on catastrophic failure
    try {
      await Campaign.findByIdAndUpdate(req.params.id, { status: "failed" });
    } catch {
      /* */
    }
    console.error("adminSendCampaign error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error while sending." });
  }
};

// POST /api/newsletter/admin/campaigns/:id/test — send test email to admin only
const adminSendTestEmail = async (req, res) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail)
      return res
        .status(400)
        .json({ success: false, message: "testEmail is required." });

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign)
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found." });

    if (!BREVO_API_KEY) {
      return res
        .status(500)
        .json({ success: false, message: "Brevo API key not configured." });
    }

    const payload = {
      sender: {
        name: campaign.fromName,
        email: campaign.fromEmail || process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: testEmail, name: "Admin Test" }],
      subject: `[TEST] ${campaign.subject}`,
      htmlContent: campaign.htmlContent,
      ...(campaign.textContent ? { textContent: campaign.textContent } : {}),
    };

    await axios.post(`${BREVO_BASE}/smtp/email`, payload, {
      headers: brevoHeaders(),
    });

    return res
      .status(200)
      .json({ success: true, message: `Test email sent to ${testEmail}.` });
  } catch (error) {
    console.error("adminSendTestEmail error:", error);
    return res.status(500).json({
      success: false,
      message: error?.response?.data?.message || "Failed to send test email.",
    });
  }
};

module.exports = {
  // Public
  subscribe,
  unsubscribe,
  // Admin — subscribers
  adminGetSubscribers,
  adminGetSubscriberStats,
  adminAddSubscriber,
  adminUpdateSubscriber,
  adminDeleteSubscriber,
  adminBulkDeleteSubscribers,
  // Admin — campaigns
  adminGetCampaigns,
  adminGetCampaignById,
  adminCreateCampaign,
  adminUpdateCampaign,
  adminDeleteCampaign,
  adminSendCampaign,
  adminSendTestEmail,
};
