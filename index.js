const express = require("express");
const { create } = require("@open-wa/wa-automate");
const puppeteer = require("puppeteer");
const admin = require("firebase-admin");
const path = require("path");
const qrcode = require("qrcode-terminal"); // ✅ QR in console

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

// Message queue for pending messages
let messageQueue = [];

/* ------------------ WHATSAPP AUTOMATE SETUP ------------------ */
(async () => {
  const executablePath = puppeteer.executablePath();

  create({
    sessionId: "render-bot",
    sessionDataPath: "./IGNORE_Session",
    multiDevice: true,
    headless: true,
    useChrome: true,
    executablePath,
    qrTimeout: 0, // Never time out QR
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

  // Show QR in console if required
  client.onQRCode((qr) => {
    console.log("📲 Scan the QR below to log in:");
    qrcode.generate(qr, { small: true });
  });

  // Send any queued messages
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

  client.onStateChanged((state) => {
    console.log("📡 WhatsApp connection state:", state);
    if (state === "CONFLICT" || state === "UNLAUNCHED") client.forceRefocus();
  });
}

/* ------------------ MESSAGE-SENDING FUNCTION ------------------ */
async function sendWhatsAppMessage(number, message) {
  if (!clientInstance) {
    console.log("⚠️ Client not ready, queuing message:", number, message);
    messageQueue.push({ number, message });
    return;
  }

  try {
    const formattedNumber = number.includes("@c.us") ? number : `${number}@c.us`;
    await clientInstance.sendText(formattedNumber, message);
    console.log(`✅ Message sent to ${number}: ${message}`);
  } catch (error) {
    console.error(`❌ Failed to send message to ${number}:`, error);
    // Retry after 5 seconds
    setTimeout(() => sendWhatsAppMessage(number, message), 5000);
  }
}

/* ------------------ MESSAGE-SENDING API ------------------ */
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
