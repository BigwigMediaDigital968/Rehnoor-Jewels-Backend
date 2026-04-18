const router = require("express").Router();
const {
  verifyPayment,
} = require("../../controller/payment/razorpayController");
const { protect } = require("../../middleware/Authmiddleware");

router.post("/razorpay/verify", protect, verifyPayment);

module.exports = router;
