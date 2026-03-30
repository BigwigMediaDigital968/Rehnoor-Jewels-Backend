const { config } = require("dotenv");
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const leadRoutes = require("./routes/LeadRoutes/LeadsRoutes");
const authRoutes = require("./routes/auth/authRoutes");
config("dotenv");

// Connect to MongoDB
connectDB();

const app = express();

// ─── Core Middleware ───────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────
app.get("/", (req, res) => {
  res.send("Rehnoor Jewellery API is running.");
});

app.use("/api/leads", leadRoutes);
app.use("/api/auth", authRoutes);

// ─── 404 Handler ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ─── Global Error Handler ─────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong." });
});

// ─── Start Server ─────────────────────────────
app.listen(process.env.PORT || 8000, () => {
  console.log(`Server running on port ${process.env.PORT || 8000}`);
});
