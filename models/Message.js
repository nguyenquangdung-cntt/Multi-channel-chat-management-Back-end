// models/Message.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
    userID: String,
    pageID: String,
    conversationID: String,
    senderID: String,
    senderName: String,
    message: String,
    image: String, // New field to store image URLs
}, { timestamps: true });

module.exports = mongoose.model("Message", MessageSchema);
