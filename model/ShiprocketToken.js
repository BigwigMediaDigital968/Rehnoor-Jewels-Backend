const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  token: String,
  generatedAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model("ShiprocketToken", schema);
