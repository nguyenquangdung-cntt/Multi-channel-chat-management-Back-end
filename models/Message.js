const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: String,
  recipientId: String,
  message: String,
  direction: { type: String, enum: ["in", "out"] },
  pageID: String,
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Message || mongoose.model("Message", messageSchema);
