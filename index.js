const express = require("express");
const { create } = require("@open-wa/wa-automate");
const puppeteer = require("puppeteer");
const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
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
app.get("/", (req, res) =>
  res.send("✅ WhatsApp bot is running and session is persistent")
);

/* ------------------ SESSION PERSISTENCE SETUP ------------------ */
const SESSION_PATH = path.join(__dirname, "PERSISTENT_SESSION");
if (!fs.existsSync(SESSION_PATH)) fs.mkdirSync(SESSION_PATH);

let clientInstance = null;
let messageQueue = [];

/* ------------------ WHATSAPP CLIENT SETUP ------------------ */
(async () => {
  const executablePath = puppeteer.executablePath();

  create({
    sessionId: "render-bot",
    sessionDataPath: SESSION_PATH, // ✅ persistent session folder
    multiDevice: true,
    headless: true,
    useChrome: true,
    executablePath,
    restartOnCrash: start, // ✅ auto-restart client on crash
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

  // Listen for disconnection and attempt reconnect
  client.onStateChanged((state) => {
    console.log("📱 Client state changed:", state);
    if (["CONFLICT", "UNLAUNCHED", "UNPAIRED"].includes(state)) {
      console.log("🔄 Reinitializing client...");
      client.restart();
    }
  });

  // Deliver any queued messages
  if (messageQueue.length > 0) {
    console.log(`🔄 Sending ${messageQueue.length} queued messages...`);
    messageQueue.forEach(({ number, message }) =>
      sendWhatsAppMessage(number, message)
    );
    messageQueue = [];
  }

  // Basic command listener
  client.onMessage(async (msg) => {
    if (msg.body.toLowerCase() === "hi") {
      await client.sendText(
        msg.from,
        "👋 Hello! I’m your Render WhatsApp bot — session restored successfully!"
      );
    }
  });
}

/* ------------------ MESSAGE FUNCTION ------------------ */
async function sendWhatsAppMessage(number, message) {
  if (!clientInstance) {
    console.log("⚠️ Client not ready, queuing message:", number);
    messageQueue.push({ number, message });
    return;
  }

  try {
    const formattedNumber = number.includes("@c.us")
      ? number
      : `${number}@c.us`;
    await clientInstance.sendText(formattedNumber, message);
    console.log(`✅ Message sent to ${number}: ${message}`);
  } catch (error) {
    console.error(`❌ Failed to send message to ${number}:`, error.message);
    console.log("⏳ Retrying in 5 seconds...");
    setTimeout(() => sendWhatsAppMessage(number, message), 5000);
  }
}

/* ------------------ API ENDPOINT ------------------ */
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

/* ------------------ SERVER LISTEN ------------------ */
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));
