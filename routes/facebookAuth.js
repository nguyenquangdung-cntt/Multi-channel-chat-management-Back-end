const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Helper
// Cấu hình lưu file ảnh vào thư mục uploads/
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Serve static files for uploaded images
router.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Helper: "Saved successfully", user });
const getIO = (req) => req.app.locals.io;

// Save user and pages
router.post("/", async (req, res) => {
  const { userID, accessToken, userInfo, pages } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { userID },
      {
        accessToken,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture?.data?.url || "",
        pages: pages || [],
      },
      { upsert: true, new: true }
    );
    res.json({ message: "Saved successfully", user });
  } catch (err) {
    res.status(500).json({ error: "Error saving user" });
  }
});

// Get user by userID
router.get("/:userID", async (req, res) => {
  try {
    const user = await User.findOne({ userID: req.params.userID });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error retrieving user" });
  }
});

// Get senders and messages for a page, save to DB, and emit new messages via socket
router.get("/:userID/:pageID/senders", async (req, res) => {
  const { userID, pageID } = req.params;
  const io = getIO(req);

  try {
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: "User not found" });

    const page = user.pages.find((p) => p.id === pageID);
    if (!page) return res.status(404).json({ error: "Page not found in user's pages" });

    const accessToken = page.access_token;
    const conversationURL = `https://graph.facebook.com/v19.0/${pageID}/conversations?access_token=${accessToken}`;

    const convoRes = await fetch(conversationURL);
    const convoData = await convoRes.json();
    if (convoData.error) {
      return res.status(500).json({ error: convoData.error.message });
    }

    const result = [];

    for (const convo of convoData.data || []) {
      // Lấy cả message text và attachments (ảnh)
      const messagesURL = `https://graph.facebook.com/v19.0/${convo.id}/messages?fields=from,message,attachments&access_token=${accessToken}`;
      const msgRes = await fetch(messagesURL);
      const msgData = await msgRes.json();
      if (msgData.error) {
        continue;
      }

      const messages = msgData.data || [];
      for (const msg of messages) {
        if (!msg.from || !msg.from.id) continue;

        // Nếu là ảnh, lấy URL ảnh
        let imageUrl = null;
        if (msg.attachments && msg.attachments.data && msg.attachments.data.length > 0) {
          const attach = msg.attachments.data[0];
          if (attach.type === "image" && attach.image_data && attach.image_data.url) {
            imageUrl = attach.image_data.url;
          }
        }

        // Kiểm tra đã lưu chưa
        const existed = await Message.findOne({
          conversationID: convo.id,
          senderID: msg.from.id,
          message: msg.message || "",
          image: imageUrl || "",
        });

        await Message.findOneAndUpdate(
          {
            conversationID: convo.id,
            senderID: msg.from.id,
            message: msg.message || "",
            image: imageUrl || "",
          },
          {
            userID,
            pageID,
            conversationID: convo.id,
            senderID: msg.from.id,
            senderName: msg.from.name || "",
            message: msg.message || "",
            image: imageUrl || "",
          },
          { upsert: true, new: true }
        );

        if (!existed && msg.from.id !== pageID) {
          io.to(pageID).emit("new_message", {
            userID,
            pageID,
            recipientID: msg.from.id,
            message: msg.message,
            image: imageUrl,
            from: "user",
            time: Date.now(),
          });
        }
      }

      result.push({
        conversationID: convo.id,
        messages,
      });
    }

    io.to(pageID).emit("update_conversations", { userID, pageID });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch and save senders/messages" });
  }
});

// Agent gửi tin nhắn (có thể gửi ảnh)
router.post("/:userID/:pageID/send-message", upload.single("image"), async (req, res) => {
  const { userID, pageID } = req.params;
  const { recipientID, message } = req.body;
  const image = req.file;
  const io = getIO(req);

  if (!recipientID || (!message && !image)) {
    return res.status(400).json({ error: "Missing recipientID, message, or image" });
  }

  try {
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: "User not found" });

    const page = user.pages.find((p) => p.id === pageID);
    if (!page) return res.status(404).json({ error: "Page not found in user's pages" });

    const accessToken = page.access_token;

    // Lấy conversationID giữa page và recipientID
    let conversationID = null;
    const conversationURL = `https://graph.facebook.com/v19.0/${pageID}/conversations?access_token=${accessToken}`;
    const convoRes = await fetch(conversationURL);
    const convoData = await convoRes.json();
    if (convoData && convoData.data && convoData.data.length > 0) {
      for (const convo of convoData.data) {
        // Lấy participants của conversation
        const participantsURL = `https://graph.facebook.com/v19.0/${convo.id}/participants?access_token=${accessToken}`;
        const partRes = await fetch(participantsURL);
        const partData = await partRes.json();
        if (
          partData &&
          partData.data &&
          partData.data.some((p) => p.id === recipientID)
        ) {
          conversationID = convo.id;
          break;
        }
      }
    }

    const body = {
      recipient: { id: recipientID },
      message: {},
    };

    let localImageUrl = null;
    if (message) {
      body.message.text = message;
    }
    if (image) {
      localImageUrl = `/uploads/${image.filename}`;

      // Upload ảnh lên Facebook Messenger
      const FormData = require("form-data");
      const formData = new FormData();
      formData.append(
        "message",
        JSON.stringify({
          attachment: {
            type: "image",
            payload: { is_reusable: true },
          },
        })
      );
      formData.append("filedata", fs.createReadStream(image.path));

      const fbUploadRes = await fetch(`https://graph.facebook.com/v19.0/me/message_attachments?access_token=${accessToken}`, {
        method: "POST",
        body: formData,
      });
      const fbUploadData = await fbUploadRes.json();
      if (!fbUploadRes.ok) {
        return res.status(fbUploadRes.status).json({ error: fbUploadData.error.message });
      }
      body.message.attachment = {
        type: "image",
        payload: { attachment_id: fbUploadData.attachment_id },
      };
    }

    const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const fbData = await fbRes.json();
    if (!fbRes.ok) {
      return res.status(fbRes.status).json({ error: fbData.error.message });
    }

    // Lưu vào DB với conversationID đúng
    await Message.create({
      userID,
      pageID,
      conversationID: conversationID,
      senderID: pageID,
      senderName: "Agent",
      message: message || "",
      image: localImageUrl || "",
    });

    io.to(pageID).emit("new_message", {
      userID,
      pageID,
      recipientID,
      message,
      image: localImageUrl,
      from: "bot",
      time: Date.now(),
    });

    res.json({ success: true, image: localImageUrl });
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;