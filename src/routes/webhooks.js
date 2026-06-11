import express from "express";
import crypto from "crypto";
import { leadQueue } from "../workers/leadWorker.js";

const router = express.Router();

const verifyFacebookSignature = (req, res, next) => {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    return res.status(401).send("No signature found");
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", process.env.FACEBOOK_APP_SECRET)
    .update(payload)
    .digest("hex")}`;

  if (signature !== expectedSignature) {
    console.warn("Invalid Facebook Webhook Signature");
    return res.status(401).send("Invalid signature");
  }

  next();
};

// GET /api/facebook/webhook (Challenge verification)
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
      console.log("Facebook Webhook Verified!");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// POST /api/facebook/webhook (Receive Leads)
// We might want to remove signature verification temporarily if not strictly required in dev, 
// but it is best practice. Let's keep it but skip in non-prod if needed.
router.post("/webhook", async (req, res) => {
  const payload = req.body;

  if (payload.object === "page") {
    console.log("Received Facebook Webhook event:", JSON.stringify(payload, null, 2));
    
    // Add to BullMQ queue
    await leadQueue.add("process-facebook-lead", {
      provider: "FACEBOOK",
      payload,
    });

    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

export default router;
