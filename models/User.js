const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userID: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    name: { type: String },
    email: { type: String },
    picture: { type: String },
    pages: [
      {
        id: { type: String },
        name: { type: String },
        access_token: { type: String },
        category: { type: String },
      }
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
