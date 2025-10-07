
const express = require("express");
const { create } = require("@open-wa/wa-automate");
const puppeteer = require("puppeteer");
const admin = require("firebase-admin");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to handle JSON requests
app.use(express.json());

/* ------------------ FIREBASE INITIALIZATION ------------------ */
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(__dirname, "ServiceAccountKey.json");

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
  console.log("🔥 Firebase initialized successfully");
} catch (err) {
  console.error("❌ Firebase initialization failed:", err);
}

/* ------------------ EXPRESS SERVER ------------------ */
app.get("/", (req, res) => res.send("✅ WhatsApp bot is running on Render"));

let clientInstance = null;

/* ------------------ WHATSAPP AUTOMATE SETUP ------------------ */
(async () => {
  const executablePath = puppeteer.executablePath();

  create({
    sessionId: "render-bot",
    sessionDataPath: "./IGNORE_Session", // ✅ Custom session folder
    multiDevice: true,
    headless: true,
    useChrome: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  })
    .then((client) => start(client))
    .catch((err) => console.error("❌ Error launching browser:", err));
})();

/* ------------------ BOT LOGIC ------------------ */
function start(client) {
  console.log("🤖 WhatsApp client started!");
  clientInstance = client;

  client.onMessage(async (msg) => {
    if (msg.body.toLowerCase() === "hi") {
      await client.sendText(msg.from, "👋 Hello! I’m your Render WhatsApp bot!");
    }
  });
}

/* ------------------ MESSAGE-SENDING API ------------------ */
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res
      .status(400)
      .json({ success: false, error: "number and message are required" });
  }

  if (!clientInstance) {
    return res
      .status(503)
      .json({ success: false, error: "WhatsApp client not yet ready" });
  }

  try {
    const formattedNumber = number.includes("@c.us")
      ? number
      : `${number}@c.us`;
    await clientInstance.sendText(formattedNumber, message);
    console.log(`✅ Message sent to ${number}: ${message}`);
    return res.json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to send" });
  }
});

/* ------------------ SERVER LISTEN ------------------ */
app.listen(PORT, () =>
  console.log(`🌍 Server running on port ${PORT}`)
);

