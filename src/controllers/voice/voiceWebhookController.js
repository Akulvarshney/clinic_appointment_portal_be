import prisma from "../../prisma.js";
import * as VoiceCallService from "../../services/voice/VoiceCallService.js";
import * as TwilioVoiceService from "../../services/voice/TwilioVoiceService.js";
import { decryptSecret } from "../../util/encryption.js";

/**
 * Twilio webhooks have no user session, so they cannot go through
 * loginMiddleware. Instead, authenticity is verified per-request using
 * Twilio's X-Twilio-Signature header, checked against the auth token of the
 * organization that owns the call (resolved from the CallSid in the body).
 */

const buildWebhookUrl = (req, path) => {
  const backendPublicUrl = process.env.BACKEND_PUBLIC_URL;
  const base = backendPublicUrl
    ? backendPublicUrl.replace(/\/$/, "")
    : `${req.protocol}://${req.get("host")}`;
  return `${base}${path}`;
};

const verifySignature = async (req, path) => {
  const callSid = req.body?.CallSid;
  if (!callSid) return false;

  const callLog = await prisma.voiceCallLog.findUnique({
    where: { twilio_call_sid: callSid },
    select: { organization_id: true },
  });
  if (!callLog) return false;

  const configuration = await prisma.organizationVoiceConfiguration.findUnique({
    where: { organization_id: callLog.organization_id },
    select: { twilio_token: true },
  });
  if (!configuration) return false;

  const signature = req.headers["x-twilio-signature"];
  const webhookUrl = buildWebhookUrl(req, path);

  return TwilioVoiceService.isValidTwilioSignature({
    authToken: decryptSecret(configuration.twilio_token),
    signature,
    webhookUrl,
    params: req.body,
  });
};

export const callStatusWebhookController = async (req, res) => {
  try {
    const valid = await verifySignature(req, "/api/v1/voice/webhooks/call-status");
    if (!valid && process.env.NODE_ENV === "production") {
      return res.status(403).send("Invalid signature");
    }

    await VoiceCallService.handleStatusWebhook(req.body);
    return res.status(200).send("OK");
  } catch (error) {
    console.error("Voice call-status webhook error:", error);
    // Ack with 200 so Twilio does not keep retrying on our internal errors.
    return res.status(200).send("OK");
  }
};

export const recordingStatusWebhookController = async (req, res) => {
  try {
    const valid = await verifySignature(req, "/api/v1/voice/webhooks/recording-status");
    if (!valid && process.env.NODE_ENV === "production") {
      return res.status(403).send("Invalid signature");
    }

    await VoiceCallService.handleRecordingWebhook(req.body);
    return res.status(200).send("OK");
  } catch (error) {
    console.error("Voice recording-status webhook error:", error);
    return res.status(200).send("OK");
  }
};
