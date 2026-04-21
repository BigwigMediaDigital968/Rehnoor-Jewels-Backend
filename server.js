const { config } = require("dotenv");
config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const leadRoutes = require("./routes/LeadRoutes/LeadsRoutes");
const authRoutes = require("./routes/auth/authRoutes");
const productRoutes = require("./routes/products/productroutes");
const collectionRoutes = require("./routes/collections/collectionRoutes");
const categoryRoutes = require("./routes/category/categoryRoutes");
const reviewRoutes = require("./routes/reviews/reviewRoutes");
const orderRoutes = require("./routes/order/orderRoutes");
const newsletterRoutes = require("./routes/news/newsRoutes");
const blogRoutes = require("./routes/blog/blogRoutes");

const webhookRoutes = require("./routes/webhooks/webhook.routes"); // ← MUST be first
const paymentRoutes = require("./routes/payment/payment.routes");
const shippingRoutes = require("./routes/shipping/shipping.routes");

// Connect to MongoDB
connectDB();

const app = express();

// ─── Webhook routes — raw body, BEFORE express.json() ────────────────────────
// Razorpay signature verification breaks if JSON middleware runs first
app.use("/webhooks", webhookRoutes);

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
app.use("/api/products", productRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api", categoryRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/blogs", blogRoutes);

app.use("/api/payments", paymentRoutes); // POST /api/payments/razorpay/verify
app.use("/api/shipping", shippingRoutes); // admin shipment + public tracking

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
