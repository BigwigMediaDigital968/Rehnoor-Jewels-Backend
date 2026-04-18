const router = require("express").Router();
const { protect, adminOnly } = require("../../middleware/Authmiddleware");
const {
  pushOrder,
  requestPickup,
  generateAWB,
} = require("../../controller/shipping/shiprocketController");
const { trackByAWB } = require("../../services/shipping/trackingService");

router.post("/admin/:orderId/push", protect, adminOnly, pushOrder);
router.post("/admin/pickup", protect, adminOnly, requestPickup);
router.post("/admin/:orderId/awb", protect, adminOnly, generateAWB);

// Public tracking
router.get("/track/:awb", async (req, res) => {
  const data = await trackByAWB(req.params.awb);
  res.json({ success: true, data });
});

module.exports = router;
