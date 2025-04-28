const express = require("express");
const router = express.Router();
const User = require("../models/User");
const fetch = require("node-fetch");

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "s3cr3tWebhookToken"; // 🔥 lấy từ env nếu có

// Save user info + page token
router.post("/", async (req, res) => {
  const { userID, accessToken, userInfo, pageID, pageAccessToken } = req.body;

  try {
    const user = await User.findOneAndUpdate(
      { userID },
      {
        accessToken,
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture?.data?.url || "",
        pageID,
        pageAccessToken,
      },
      { upsert: true, new: true }
    );
    res.json({ message: "Saved successfully", user });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Error saving user" });
  }
});

// Get user by ID
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

// Gửi tin nhắn từ Fanpage
router.post("/send-message", async (req, res) => {
  const { userID, recipientId, message } = req.body;

  try {
    const user = await User.findOne({ userID });
    if (!user?.pageAccessToken || !user?.pageID) {
      return res.status(400).json({ error: "Page token or ID missing" });
    }

    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${user.pageID}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
          messaging_type: "MESSAGE_TAG",
          tag: "ACCOUNT_UPDATE",
        }),
      }
    );

    const data = await fbRes.json();
    if (data.error) {
      console.error("FB API Error:", data.error);
      return res.status(400).json({ error: data.error });
    }

    res.json({ message: "Message sent successfully", data });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Webhook xác thực từ Meta (verify)
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("Webhook Verification Attempt:", { mode, token });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    console.warn("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// Webhook nhận tin nhắn từ Facebook
router.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry) {
      const event = entry.messaging?.[0];

      if (event?.message && event?.sender) {
        const senderId = event.sender.id;
        const messageText = event.message.text;

        console.log(`📩 Message from ${senderId}: ${messageText}`);

        try {
          const user = await User.findOne({ pageID: entry.id });
          if (user?.pageAccessToken) {
            await fetch(
              `https://graph.facebook.com/v19.0/${user.pageID}/messages`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: senderId },
                  message: { text: `🤖 Bot received: "${messageText}"` },
                  messaging_type: "RESPONSE",
                }),
              }
            );
            console.log("✅ Auto reply sent");
          } else {
            console.warn("⚠️ Page Access Token not found for this page");
          }
        } catch (err) {
          console.error("❌ Error sending auto reply:", err);
        }
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;
