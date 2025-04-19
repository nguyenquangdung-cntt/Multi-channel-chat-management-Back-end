const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Đăng ký route cho Facebook Auth
app.use("/api/facebook-auth", require("./routes/facebookAuth"));

// Đảm bảo rằng bạn có thêm route khác nếu cần
// Ví dụ: app.use("/api/other-route", require("./routes/otherRoute"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server at http://localhost:${PORT}`));
