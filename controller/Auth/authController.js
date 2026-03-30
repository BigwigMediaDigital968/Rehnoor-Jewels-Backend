const jwt = require("jsonwebtoken");

// Static admin credentials (hardcoded for now)
const ADMIN_CREDENTIALS = {
  email: "admin@rehnoor.com",
  password: "Rehnoor@Admin2025",
  name: "Rehnoor Admin",
  role: "admin",
};

// POST /api/auth/login
const adminLogin = (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    if (
      email !== ADMIN_CREDENTIALS.email ||
      password !== ADMIN_CREDENTIALS.password
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        name: ADMIN_CREDENTIALS.name,
        email: ADMIN_CREDENTIALS.email,
        role: ADMIN_CREDENTIALS.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: {
        name: ADMIN_CREDENTIALS.name,
        email: ADMIN_CREDENTIALS.email,
        role: ADMIN_CREDENTIALS.role,
        token,
      },
    });
  } catch (error) {
    console.error("adminLogin error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = { adminLogin };
