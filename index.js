const express = require("express");
const { create } = require("@open-wa/wa-automate");
const puppeteer = require("puppeteer");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ---------- FIREBASE INITIALIZATION ----------
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

// ---------- EXPRESS ROUTE ----------
app.get("/", (req, res) => res.send("✅ WhatsApp bot is running on Render"));

let clientInstance = null;
let messageQueue = [];

// ---------- SESSION MANAGEMENT ----------
const SESSION_FILE = path.join(__dirname, "session_data/session.json");

// Load existing session data if available
function loadSessionData() {
  if (fs.existsSync(SESSION_FILE)) {
    console.log("📂 Existing session data found.");
    return require(SESSION_FILE);
  }
  console.log("⚠️ No previous session found, new login required.");
  return null;
}

// Save session data to file
function saveSessionData(data) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data));
  console.log("💾 Session data saved!");
}

// ---------- WHATSAPP CLIENT INITIALIZATION ----------
(async () => {
  const executablePath = puppeteer.executablePath();

  create({
    sessionId: "render-bot",
    sessionData: loadSessionData(),
    multiDevice: true,
    headless: true,
    useChrome: true,
    executablePath,
    restartOnCrash: start,
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

// ---------- BOT START ----------
function start(client) {
  clientInstance = client;
  console.log("🤖 WhatsApp client connected and running!");

  // Save session when available
  client.onStateChanged(async (state) => {
    if (state === "CONNECTED") {
      const sessionData = await client.getSessionTokenBrowser();
      saveSessionData(sessionData);
    }
  });

  // Send queued messages
  if (messageQueue.length > 0) {
    console.log(`🔄 Sending ${messageQueue.length} queued messages...`);
    messageQueue.forEach(({ number, message }) =>
      sendWhatsAppMessage(number, message)
    );
    messageQueue = [];
  }

  client.onMessage(async (msg) => {
    if (msg.body.toLowerCase() === "hi") {
      await client.sendText(msg.from, "👋 Hello! I’m your Render WhatsApp bot!");
    }
  });
}

// ---------- MESSAGE FUNCTION ----------
async function sendWhatsAppMessage(number, message) {
  if (!clientInstance) {
    console.log("⚠️ Client not ready, queuing message:", number);
    messageQueue.push({ number, message });
    return;
  }

  try {
    const formattedNumber = number.includes("@c.us") ? number : `${number}@c.us`;
    await clientInstance.sendText(formattedNumber, message);
    console.log(`✅ Message sent to ${number}: ${message}`);
  } catch (error) {
    console.error(`❌ Failed to send message to ${number}:`, error);
    setTimeout(() => sendWhatsAppMessage(number, message), 5000);
  }
}

// ---------- API ENDPOINT ----------
app.post("/send-message", async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res
      .status(400)
      .json({ success: false, error: "number and message are required" });
  }

  sendWhatsAppMessage(number, message);
  return res.json({ success: true, message: "Message queued or sent!" });
});

// ---------- SERVER LISTEN ----------
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));
