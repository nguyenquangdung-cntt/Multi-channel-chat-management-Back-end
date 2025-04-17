const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.post("/", async (req, res) => {
  const { userID, accessToken } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { userID },
      { accessToken },
      { upsert: true, new: true }
    );
    res.json({ message: "Saved successfully", user });
  } catch (err) {
    res.status(500).json({ error: "Error saving user" });
  }
});

module.exports = router;
