const express = require("express");
const router = express.Router();
const {
  submitLead,
  getAllLeads,
  getLeadById,
  updateLeadStatus,
  deleteLead,
  bulkDeleteLeads,
  getLeadStats,
} = require("../../controller/Leads/LeadController");
const { protect, adminOnly } = require("../../middleware/Authmiddleware");

// ─────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────

// Submit contact form (anyone can do this)
router.post("/add", submitLead);

// ─────────────────────────────────
// ADMIN-ONLY ROUTES
// All routes below require a valid JWT with role: "admin"
// ─────────────────────────────────

// Get lead stats summary
router.get("/stats", protect, adminOnly, getLeadStats);

// Get all leads (with optional ?status=&search=&page=&limit= filters)
router.get("/", protect, adminOnly, getAllLeads);

// Get a single lead
router.get("/:id", protect, adminOnly, getLeadById);

// Update lead status (and optional admin notes)
router.patch("/:id/status", protect, adminOnly, updateLeadStatus);

// Bulk delete — MUST be above /delete/:id
router.delete("/delete/bulk", protect, adminOnly, bulkDeleteLeads);

// Single delete
router.delete("/delete/:id", protect, adminOnly, deleteLead);

module.exports = router;
