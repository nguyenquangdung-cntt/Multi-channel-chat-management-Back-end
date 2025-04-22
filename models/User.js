const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  accessToken: { type: String, required: true },
  pageAccessToken: { type: String },  // Trường này lưu Access Token của Facebook Page
  name: { type: String },
  email: { type: String },
  picture: { type: String },
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
