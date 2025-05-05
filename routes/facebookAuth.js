const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const fetch = require("node-fetch");

// Helper
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
      const messagesURL = `https://graph.facebook.com/v19.0/${convo.id}/messages?fields=from,message&access_token=${accessToken}`;
      const msgRes = await fetch(messagesURL);
      const msgData = await msgRes.json();

      if (msgData.error) {
        continue;
      }

      const messages = msgData.data || [];

      for (const msg of messages) {
        if (!msg.from || !msg.from.id || !msg.message) continue;

        const existed = await Message.findOne({
          conversationID: convo.id,
          senderID: msg.from.id,
          message: msg.message,
        });

        await Message.findOneAndUpdate(
          {
            conversationID: convo.id,
            senderID: msg.from.id,
            message: msg.message,
          },
          {
            userID,
            pageID,
            conversationID: convo.id,
            senderID: msg.from.id,
            senderName: msg.from.name || "",
            message: msg.message,
          },
          { upsert: true, new: true }
        );

        if (!existed && msg.from.id !== pageID) {
          io.to(pageID).emit("new_message", {
            userID,
            pageID,
            recipientID: msg.from.id,
            message: msg.message,
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

// Agent gửi tin nhắn
router.post("/:userID/:pageID/send-message", async (req, res) => {
  const { userID, pageID } = req.params;
  const { recipientID, message } = req.body;
  const io = getIO(req);

  if (!recipientID || !message) {
    return res.status(400).json({ error: "Missing recipientID or message" });
  }

  try {
    const user = await User.findOne({ userID });
    if (!user) return res.status(404).json({ error: "User not found" });

    const page = user.pages.find((p) => p.id === pageID);
    if (!page) return res.status(404).json({ error: "Page not found in user's pages" });

    const accessToken = page.access_token;

    const fbRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientID },
        message: { text: message },
      }),
    });

    const fbData = await fbRes.json();

    if (!fbRes.ok) {
      const error = fbData.error;

      if (error.code === 10 && error.error_subcode === 2018278) {
        return res.status(403).json({
          error: "Tin nhắn này được gửi ngoài khoảng thời gian cho phép (24h).",
          code: error.code,
          subcode: error.error_subcode,
          type: error.type,
          isOutside24hWindow: true,
        });
      }

      return res.status(fbRes.status).json({ error: error.message });
    }

    io.to(pageID).emit("new_message", {
      userID,
      pageID,
      recipientID,
      message,
      from: "bot",
      time: Date.now(),
    });

    res.json({ success: true, response: fbData });

  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;