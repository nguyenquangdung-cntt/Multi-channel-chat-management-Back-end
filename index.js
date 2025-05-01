const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = createServer(app); // Tạo HTTP server

app.use(cors());
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// Tạo WebSocket server
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  socket.on("sendMessage", (data) => {
    console.log("📩 Tin nhắn từ client:", data);
    
    // Phát tin nhắn real-time tới tất cả client
    io.emit("newMessage", data);
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

// Đăng ký route Facebook Auth và truyền `io`
app.use("/api/facebook-auth", require("./routes/facebookAuth")(io));

// Chạy server với WebSockets
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`));
