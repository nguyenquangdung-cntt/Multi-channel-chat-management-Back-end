const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const fetch = require("node-fetch");

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "s3cr3tWebhookToken";

// Lưu user và pages
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
    console.error("DB Error:", err);
    res.status(500).json({ error: "Error saving user" });
  }
});

// Lấy user theo userID
router.get("/:userID", async (req, res) => {
  try {
    const user = await User.findOne({ userID: req.params.userID });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error retrieving user:", err);
    res.status(500).json({ error: "Error retrieving user" });
  }
});

// Gửi tin nhắn từ page đến user
router.post("/send-message", async (req, res) => {
  const { userID, recipientId, message, pageID } = req.body;

  try {
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: "User not found" });

    const page = user.pages.find((p) => p.id === pageID);
    if (!page) return res.status(404).json({ error: "Page not found" });

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
          messaging_type: "MESSAGE_TAG",
          tag: "ACCOUNT_UPDATE",
          access_token: page.access_token,
        }),
      }
    );

    const result = await response.json();

    if (result.error) {
      console.error("FB API Error:", result.error);
      return res.status(400).json({ error: result.error.message });
    }

    // Lưu tin nhắn gửi
    await Message.create({
      senderId: page.id,
      recipientId,
      message,
      direction: "out",
      pageID: page.id,
    });

    res.json({ message: "Sent successfully", result });
  } catch (error) {
    console.error("Send error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Webhook verify (GET)
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Webhook nhận tin nhắn từ page (POST)
router.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object !== "page") return res.sendStatus(404);

  try {
    for (const entry of body.entry) {
      const messaging = entry.messaging?.[0];

      if (messaging?.message && messaging.sender) {
        const senderId = messaging.sender.id;
        const messageText = messaging.message.text;

        const user = await User.findOne({ "pages.id": entry.id });
        const page = user?.pages.find((p) => p.id === entry.id);

        // Lưu message nhận được
        await Message.create({
          senderId,
          recipientId: entry.id,
          message: messageText,
          direction: "in",
          pageID: entry.id,
        });

        // Trả lời tin nhắn tự động
        if (page?.access_token) {
          await fetch(`https://graph.facebook.com/v19.0/${entry.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: { id: senderId },
              message: { text: `🤖 Bot đã nhận: "${messageText}"` },
              messaging_type: "RESPONSE",
              access_token: page.access_token,
            }),
          });
          console.log("✅ Auto-replied");
        } else {
          console.warn("⚠️ Missing page access token");
        }
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).send("Internal error");
  }
});

module.exports = router;
