const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Serve static files for uploaded images
const path = require("path");
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Kết nối MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));


app.locals.io = io;

app.use("/api/facebook-auth", require("./routes/facebookAuth"));


io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join_page", (pageID) => {
    socket.join(pageID);
    console.log(`Socket ${socket.id} joined page ${pageID}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server is running at http://localhost:${PORT}`));