const express = require("express");
const router = express.Router();
const User = require("../models/User");

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
      `https://graph.facebook.com/v19.0/me/messages?access_token=${user.pageAccessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
          messaging_type: "RESPONSE",
        }),
      }
    );

    const data = await fbRes.json();
    if (data.error) throw new Error(data.error.message);

    res.json({ message: "Message sent", data });
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

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    console.warn("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

// Webhook nhận tin nhắn
router.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    body.entry.forEach(async (entry) => {
      const event = entry.messaging?.[0];
      if (event && event.message && event.sender) {
        const senderId = event.sender.id;
        const messageText = event.message.text;

        console.log(`📩 Message from ${senderId}: ${messageText}`);

        // (Tùy chọn) tự động phản hồi
        try {
          // Tìm token theo pageID
          const user = await User.findOne({ pageID: entry.id });
          if (user?.pageAccessToken) {
            await fetch(
              `https://graph.facebook.com/v19.0/me/messages?access_token=${user.pageAccessToken}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  recipient: { id: senderId },
                  message: { text: `Bot nhận được: ${messageText}` },
                }),
              }
            );
          }
        } catch (err) {
          console.error("❌ Error sending auto reply:", err);
        }
      }
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

module.exports = router;
