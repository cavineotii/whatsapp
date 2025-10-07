const express = require("express");
const { create } = require("@open-wa/wa-automate");
const puppeteer = require("puppeteer");
const admin = require("firebase-admin");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* ------------------ FIREBASE INITIALIZATION ------------------ */
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "ServiceAccountKey.json");

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
  console.log("🔥 Firebase initialized successfully");
} catch (err) {
  console.error("❌ Firebase initialization failed:", err);
}

/* ------------------ EXPRESS SERVER ------------------ */
app.get("/", (req, res) => res.send("✅ WhatsApp bot is running on Render"));
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));

/* ------------------ WHATSAPP AUTOMATE SETUP ------------------ */
(async () => {
  // Use Puppeteer's built-in Chromium for Render compatibility
  const executablePath = puppeteer.executablePath();

  create({
    sessionId: "render-bot",
    multiDevice: true,
    headless: true,
    useChrome: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process"
    ]
  })
    .then(client => start(client))
    .catch(err => console.error("❌ Error launching browser:", err));
})();

/* ------------------ BOT LOGIC ------------------ */
function start(client) {
  console.log("🤖 WhatsApp client started!");
  client.onMessage(async (msg) => {
    if (msg.body.toLowerCase() === "hi") {
      await client.sendText(msg.from, "👋 Hello! I’m your Render WhatsApp bot!");
    }
  });
}
