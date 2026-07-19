import { Router } from "express";
import express from "express";
import {
  callStatusWebhookController,
  recordingStatusWebhookController,
} from "../../controllers/voice/voiceWebhookController.js";

const router = Router();

// Twilio posts callbacks as application/x-www-form-urlencoded. The app-level
// middleware only parses JSON, so it is parsed locally for this sub-router.
router.use(express.urlencoded({ extended: false }));

router.post("/call-status", callStatusWebhookController);
router.post("/recording-status", recordingStatusWebhookController);

export default router;
