// facebookAuth.js (backend route)

const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/", async (req, res) => {
  const { userID, accessToken, userInfo } = req.body;
  try {
    // Save or update user in the database
    const user = await User.findOneAndUpdate(
      { userID },
      { accessToken, name: userInfo.name, email: userInfo.email, picture: userInfo.picture.data.url },
      { upsert: true, new: true }
    );
    res.json({ message: "Saved successfully", user });
  } catch (err) {
    res.status(500).json({ error: "Error saving user" });
  }
});

// Fetch user info from database
router.get("/:userID", async (req, res) => {
  try {
    const user = await User.findOne({ userID: req.params.userID });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Error retrieving user" });
  }
});

module.exports = router;
