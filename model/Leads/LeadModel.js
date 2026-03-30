const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
      default: null,
      match: [/^[+\d\s\-()]{7,20}$/, "Please enter a valid phone number"],
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      enum: {
        values: [
          "General Inquiry",
          "Order Support",
          "Custom Jewellery",
          "Returns & Refunds",
          "Wholesale",
          "Other",
        ],
        message: "Please select a valid subject",
      },
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [1000, "Message cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["new", "in-progress", "resolved", "spam"],
      default: "new",
    },
    adminNotes: {
      type: String,
      trim: true,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  },
);

// Index for faster admin queries
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ email: 1 });

module.exports = mongoose.model("Lead", leadSchema);
