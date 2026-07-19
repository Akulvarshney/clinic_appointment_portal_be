import twilio from "twilio";

/**
 * All Twilio-specific logic is isolated in this service. Every other part of
 * the Voice Calls module (controllers, other services, repositories) talks
 * to Twilio only through the functions exported here. This keeps the door
 * open to plugging in another provider (e.g. Plivo/Exotel) later, or adding
 * IVR/inbound handling, without touching the rest of the module.
 */

/** Maps Twilio's call status strings to our VoiceCallStatus enum values. */
const TWILIO_STATUS_MAP = {
  queued: "QUEUED",
  ringing: "RINGING",
  "in-progress": "IN_PROGRESS",
  completed: "COMPLETED",
  busy: "BUSY",
  failed: "FAILED",
  "no-answer": "NO_ANSWER",
  canceled: "CANCELED",
};

export const mapTwilioCallStatus = (twilioStatus) => {
  if (!twilioStatus) return undefined;
  return TWILIO_STATUS_MAP[String(twilioStatus).toLowerCase()];
};

const buildClient = (accountSid, authToken) => {
  if (!accountSid || !authToken) {
    throw new Error("Twilio account SID and auth token are required");
  }
  try {
    return twilio(accountSid, authToken);
  } catch (error) {
    // The Twilio SDK throws synchronously (e.g. "accountSid must start with
    // AC...") when the stored credentials aren't even shaped like real
    // Twilio credentials - surface that as an actionable configuration
    // error instead of a raw SDK message.
    throw new Error(
      "Invalid Twilio credentials configured for this organization. Please re-check the Account SID and Auth Token under Voice Calls > Configuration."
    );
  }
};

/**
 * Minimal inline TwiML played to the called party once they pick up.
 * Extracted into its own function so future IVR flows / <Dial> bridging to
 * an agent leg can replace this without touching callers of initiateCall.
 */
const buildConnectTwiml = () => {
  const response = new twilio.twiml.VoiceResponse();
  response.say(
    { voice: "alice" },
    "You are being connected. Please stay on the line."
  );
  return response.toString();
};

/**
 * Initiates an outbound PSTN call via Twilio and returns the created call's
 * SID + initial status. Status/recording updates arrive asynchronously via
 * the configured webhook URLs.
 */
export const initiateOutboundCall = async ({
  accountSid,
  authToken,
  fromNumber,
  toNumber,
  statusCallbackUrl,
  recordingStatusCallbackUrl,
}) => {
  const client = buildClient(accountSid, authToken);
console.log("fromNumber", fromNumber);
console.log("toNumber", toNumber);
console.log("statusCallbackUrl", statusCallbackUrl);
console.log("recordingStatusCallbackUrl", recordingStatusCallbackUrl);
  try {
    const call = await client.calls.create({
      from: fromNumber,
      to: toNumber,
      twiml: buildConnectTwiml(),
      record: true,
      recordingStatusCallback: recordingStatusCallbackUrl,
      recordingStatusCallbackMethod: "POST",
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
    console.log({
      code: err.code,
      message: err.message,
      moreInfo: err.moreInfo,
      status: err.status,
    });

    return {
      callSid: call.sid,
      status: mapTwilioCallStatus(call.status) || "QUEUED",
    };
  } catch (error) {
    // Twilio's own error codes: https://www.twilio.com/docs/api/errors
    if (error?.code === 20003) {
      throw new Error(
        "Twilio rejected the request - the Account SID / Auth Token configured for this organization are incorrect."
      );
    }
    if (error?.code === 21212 || error?.code === 21603) {
      throw new Error(
        "Twilio rejected the 'from' number - it must be a valid Twilio number owned by this account."
      );
    }
    if (error?.code === 21211) {
      throw new Error("Twilio rejected the 'to' number - it is not a valid phone number.");
    }
    if (error?.code === 21215 || error?.code === 21216) {
      throw new Error(
        "Twilio blocked this call for this account. This is usually because Voice Dialing Geographic Permissions for the destination country are not enabled - go to Twilio Console > Voice > Settings > Geo Permissions and enable the destination country, then retry."
      );
    }
    console.log("error", error.code);
    throw new Error(error?.message || "Failed to place the call via Twilio");
  }
};

/**
 * Fetches the actual recording audio bytes from Twilio using Basic Auth with
 * the org's own credentials. This is the only place the recording is ever
 * touched with real Twilio credentials - the resulting buffer is streamed
 * back to the frontend by our own API so the Twilio Auth Token itself never
 * has to be sent to (or stored in) the browser.
 */
export const fetchRecordingMedia = async ({ accountSid, authToken, recordingUrl }) => {
  if (!recordingUrl) {
    throw new Error("No recording URL available for this call");
  }

  const mediaUrl = recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${basicAuth}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recording from Twilio (status ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
};

/**
 * Verifies that an incoming webhook request genuinely originated from
 * Twilio for the given organization's auth token, using Twilio's signed
 * X-Twilio-Signature header. Returns false (rather than throwing) so
 * callers can respond with a generic 403 without leaking details.
 */
export const isValidTwilioSignature = ({
  authToken,
  signature,
  webhookUrl,
  params,
}) => {
  try {
    if (!authToken || !signature) return false;
    return twilio.validateRequest(authToken, signature, webhookUrl, params);
  } catch (error) {
    console.error("Twilio signature validation error:", error);
    return false;
  }
};
