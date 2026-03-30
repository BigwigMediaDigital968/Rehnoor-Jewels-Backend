const express = require("express");
const router = express.Router();
const { adminLogin } = require("../../controller/Auth/authController");

// POST /api/auth/login
router.post("/login", adminLogin);

module.exports = router;
