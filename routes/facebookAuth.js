const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Save user + page access token
router.post("/", async (req, res) => {
  const { userID, accessToken, userInfo, pageID, pageAccessToken } = req.body;

  console.log("Request Body:", req.body);  // Log the incoming data for debugging

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
      { upsert: true, new: true } // upsert ensures if user doesn't exist, it'll be created
    );

    console.log("Saved User:", user); // Log saved user for debugging

    res.json({ message: "Saved successfully", user });
  } catch (err) {
    console.error("DB Error:", err);  // Log error for debugging
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
    console.error("Error retrieving user:", err);  // Log error for debugging
    res.status(500).json({ error: "Error retrieving user" });
  }
});

// Send message from page
router.post("/send-message", async (req, res) => {
  const { userID, recipientId, message } = req.body;

  try {
    const user = await User.findOne({ userID });
    if (!user?.pageAccessToken || !user?.pageID) {
      return res.status(400).json({ error: "Page token or ID missing" });
    }

    // Make API call to Facebook Graph API to send message
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
    console.error("Send message error:", error); // Log error for debugging
    res.status(500).json({ error: "Failed to send message" });
  }
});

module.exports = router;
