const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Register Facebook Auth Routes
app.use("/api/facebook-auth", require("./routes/facebookAuth"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server is running at http://localhost:${PORT}`));
