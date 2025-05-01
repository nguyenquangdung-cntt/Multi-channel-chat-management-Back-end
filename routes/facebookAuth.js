module.exports = (io) => {
  const express = require("express");
  const router = express.Router();
  const User = require("../models/User");
  const Message = require("../models/Message");
  const fetch = require("node-fetch");

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

  // Lấy danh sách senders từ các conversation của một page
  router.get("/:userID/:pageID/senders", async (req, res) => {
    const { userID, pageID } = req.params;

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
        console.error("Conversation API error:", convoData.error);
        return res.status(500).json({ error: convoData.error.message });
      }

      const result = [];

      for (const convo of convoData.data || []) {
        const messagesURL = `https://graph.facebook.com/v19.0/${convo.id}/messages?fields=from,message&access_token=${accessToken}`;
        const msgRes = await fetch(messagesURL);
        const msgData = await msgRes.json();

        if (msgData.error) {
          console.warn(`Error fetching messages for ${convo.id}:`, msgData.error.message);
          continue;
        }

        const messages = msgData.data || [];

        for (const msg of messages) {
          if (!msg.from || !msg.from.id || !msg.message) continue;

          await Message.findOneAndUpdate(
            { conversationID: convo.id, senderID: msg.from.id, message: msg.message },
            { userID, pageID, conversationID: convo.id, senderID: msg.from.id, senderName: msg.from.name || "", message: msg.message },
            { upsert: true, new: true }
          );

          // 🔥 PHÁT TIN NHẮN REAL-TIME 🔥
          io.emit("newMessage", {
            senderId: msg.from.id,
            recipientId: userID,
            pageId: pageID,
            message: msg.message,
          });
        }

        result.push({
          conversationID: convo.id,
          messages,
        });
      }

      res.json(result);
    } catch (err) {
      console.error("Error fetching senders:", err);
      res.status(500).json({ error: "Failed to fetch and save senders/messages" });
    }
  });

  return router;
};
