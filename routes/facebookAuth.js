const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const fetch = require("node-fetch");
const fs = require("fs");ulter");
const path = require("path");
const multer = require("multer");
// Helper
// Cấu hình lưu file ảnh vào thư mục uploads/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },const user = await User.findOneAndUpdate(
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },    name: userInfo.name,
});     email: userInfo.email,
const upload = multer({ storage });data?.url || "",
        pages: pages || [],
// Serve static files for uploaded images
router.use("/uploads", express.static(path.join(__dirname, "../uploads")));
    );
// Helper: "Saved successfully", user });
const getIO = (req) => req.app.locals.io;

// Save user and pages
router.post("/", async (req, res) => {
  const { userID, accessToken, userInfo, pages } = req.body;
  try {user by userID
    const user = await User.findOneAndUpdate(", async (req, res) => {
      { userID },
      {ndOne({ userID: req.params.userID });
        accessToken,e: "User not found" });
        name: userInfo.name,
        email: userInfo.email,h (err) {
        picture: userInfo.picture?.data?.url || "", "Error retrieving user" });
        pages: pages || [],
      },
      { upsert: true, new: true }
    );mit new messages via socket
    res.json({ message: "Saved successfully", user });ter.get("/:userID/:pageID/senders", async (req, res) => {
  } catch (err) {onst { userID, pageID } = req.params;
    res.status(500).json({ error: "Error saving user" });  const io = getIO(req);
  }
});
st user = await User.findOne({ userID });
// Get user by userID" });
router.get("/:userID", async (req, res) => {
  try {er.pages.find((p) => p.id === pageID);
    const user = await User.findOne({ userID: req.params.userID });turn res.status(404).json({ error: "Page not found in user's pages" });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user); const accessToken = page.access_token;
  } catch (err) { const conversationURL = `https://graph.facebook.com/v19.0/${pageID}/conversations?access_token=${accessToken}`;
    res.status(500).json({ error: "Error retrieving user" });
  }
});

// Get senders and messages for a page, save to DB, and emit new messages via socket {
router.get("/:userID/:pageID/senders", async (req, res) => {      return res.status(500).json({ error: convoData.error.message });
  const { userID, pageID } = req.params;
  const io = getIO(req);

  try {
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: "User not found" });from,message&access_token=${accessToken}`;
      const msgRes = await fetch(messagesURL);
    const page = user.pages.find((p) => p.id === pageID);
    if (!page) return res.status(404).json({ error: "Page not found in user's pages" });
      if (msgData.error) {
    const accessToken = page.access_token;
    const conversationURL = `https://graph.facebook.com/v19.0/${pageID}/conversations?access_token=${accessToken}`;

    const convoRes = await fetch(conversationURL);Data.data || [];
    const convoData = await convoRes.json();
 for (const msg of messages) {
    if (convoData.error) {        if (!msg.from || !msg.from.id || !msg.message) continue;
      return res.status(500).json({ error: convoData.error.message });
    }        const existed = await Message.findOne({

    const result = [];

    for (const convo of convoData.data || []) {
      // Lấy cả message text và attachments (ảnh)
      const messagesURL = `https://graph.facebook.com/v19.0/${convo.id}/messages?fields=from,message,attachments&access_token=${accessToken}`;        await Message.findOneAndUpdate(
      const msgRes = await fetch(messagesURL);
      const msgData = await msgRes.json();rsationID: convo.id,
     senderID: msg.from.id,
      if (msgData.error) {            message: msg.message,
        continue;
      }          {

      const messages = msgData.data || [];
            conversationID: convo.id,
      for (const msg of messages) {
        if (!msg.from || !msg.from.id) continue;from.name || "",

        // Nếu là ảnh, lấy URL ảnh
        let imageUrl = null;
        if (msg.attachments && msg.attachments.data && msg.attachments.data.length > 0) {
          const attach = msg.attachments.data[0];
          if (attach.type === "image" && attach.image_data && attach.image_data.url) {f (!existed && msg.from.id !== pageID) {
            imageUrl = attach.image_data.url;          io.to(pageID).emit("new_message", {
          }
        }
d,
        // Kiểm tra đã lưu chưa,
        const existed = await Message.findOne({
          conversationID: convo.id,
          senderID: msg.from.id,);
          message: msg.message || "",        }
          image: imageUrl || "",
        });

        await Message.findOneAndUpdate(
          {
            conversationID: convo.id,
            senderID: msg.from.id,
            message: msg.message || "",
            image: imageUrl || "",mit("update_conversations", { userID, pageID });
          },
          {
            userID,
            pageID,
            conversationID: convo.id,ed to fetch and save senders/messages" });
            senderID: msg.from.id,
            senderName: msg.from.name || "",
            message: msg.message || "",
            image: imageUrl || "",ửi tin nhắn
          },router.post("/:userID/:pageID/send-message", upload.single("image"), async (req, res) => {
          { upsert: true, new: true }
        );
.file; // Access the uploaded image
        if (!existed && msg.from.id !== pageID) {req);
          io.to(pageID).emit("new_message", {
            userID,& !image)) {
            pageID,son({ error: "Missing recipientID, message, or image" });
            recipientID: msg.from.id,
            message: msg.message,
            image: imageUrl,
            from: "user", user = await User.findOne({ userID });
            time: Date.now(),(!user) return res.status(404).json({ error: "User not found" });
          });
        }er.pages.find((p) => p.id === pageID);
      }404).json({ error: "Page not found in user's pages" });

      result.push({ accessToken = page.access_token;
        conversationID: convo.id,
        messages,    const body = {
      });
    }      message: {},

    io.to(pageID).emit("update_conversations", { userID, pageID });
{
    res.json(result);
 }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch and save senders/messages" });    if (image) {
  }ch(`https://graph.facebook.com/v19.0/me/message_attachments?access_token=${accessToken}`, {
});

// Agent gửi tin nhắn (có thể gửi ảnh)
router.post("/:userID/:pageID/send-message", upload.single("image"), async (req, res) => {
  const { userID, pageID } = req.params;ge",
  const { recipientID, message } = req.body;              payload: { is_reusable: true },
  const image = req.file; // Access the uploaded image
  const io = getIO(req);
     }),
  if (!recipientID || (!message && !image)) {      });
    return res.status(400).json({ error: "Missing recipientID, message, or image" });
  }es.json();

  try {        return res.status(imageUploadRes.status).json({ error: imageUploadData.error.message });
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: "User not found" });
      body.message.attachment = {
    const page = user.pages.find((p) => p.id === pageID);
    if (!page) return res.status(404).json({ error: "Page not found in user's pages" });        payload: { attachment_id: imageUploadData.attachment_id },

    const accessToken = page.access_token;

    const body = {nst fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
      recipient: { id: recipientID },      method: "POST",
      message: {},e": "application/json" },
    };      body: JSON.stringify(body),

    let localImageUrl = null;
onst fbData = await fbRes.json();
    if (message) {
      body.message.text = message;k) {
    } fbData.error.message });
    }
    if (image) {
      localImageUrl = `/uploads/${image.filename}`;

      // Upload ảnh lên Facebook Messenger
      const FormData = require("form-data");
      const formData = new FormData();
      formData.append("message", JSON.stringify({/ Emit the image path if provided
        attachment: {: "bot",
          type: "image",: Date.now(),
          payload: { is_reusable: true },
        },
      }));
      formData.append("filedata", fs.createReadStream(image.path));

      const fbUploadRes = await fetch(`https://graph.facebook.com/v19.0/me/message_attachments?access_token=${accessToken}`, {tatus(500).json({ error: "Failed to send message" });
        method: "POST",  }
        body: formData,
      });
      const fbUploadData = await fbUploadRes.json();      if (!fbUploadRes.ok) {        return res.status(fbUploadRes.status).json({ error: fbUploadData.error.message });      }      body.message.attachment = {        type: "image",        payload: { attachment_id: fbUploadData.attachment_id },      };    }    const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {      method: "POST",      headers: { "Content-Type": "application/json" },      body: JSON.stringify(body),    });    const fbData = await fbRes.json();    if (!fbRes.ok) {      return res.status(fbRes.status).json({ error: fbData.error.message });    }    // Lưu vào DB    await Message.create({      userID,      pageID,      conversationID: null,      senderID: pageID,      senderName: "Agent",      message: message || "",      image: localImageUrl || "",    });    io.to(pageID).emit("new_message", {      userID,      pageID,      recipientID,      message,      image: localImageUrl,      from: "bot",      time: Date.now(),    });    res.json({ success: true, image: localImageUrl });  } catch (err) {    res.status(500).json({ error: "Failed to send message" });  }
});

module.exports = router;