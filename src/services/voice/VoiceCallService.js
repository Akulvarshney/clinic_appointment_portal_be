import * as voiceCallRepository from "../../repositories/voice/voiceCallRepository.js";
import * as voiceConfigurationRepository from "../../repositories/voice/voiceConfigurationRepository.js";
import * as TwilioVoiceService from "./TwilioVoiceService.js";
import prisma from "../../prisma.js";
import { normalizePhoneToE164 } from "../../util/phoneNumber.js";

const ALLOWED_SORT_FIELDS = new Set([
  "created_at",
  "started_at",
  "duration_seconds",
  "status",
  "direction",
  "from_number",
  "to_number",
]);

/**
 * Publicly reachable base URL of this backend (not the frontend APP_URL),
 * used so Twilio can call back into our status/recording webhooks.
 */
const getWebhookBaseUrl = () => {
  const backendPublicUrl = process.env.BACKEND_PUBLIC_URL;
  if (!backendPublicUrl) {
    throw new Error(
      "BACKEND_PUBLIC_URL is not configured. It is required to build Twilio webhook callback URLs."
    );
  }
  return backendPublicUrl.replace(/\/$/, "");
};

/**
 * Server-side paginated, filterable, sortable list of call logs for an
 * organization (Tab 1 - Call Logs).
 */
export const listCalls = async ({
  organizationId,
  page = 1,
  limit = 20,
  sortBy = "created_at",
  sortOrder = "desc",
  filters = {},
}) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const orderField = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const orderBy = { [orderField]: sortOrder === "asc" ? "asc" : "desc" };

  const { search, dateFrom, dateTo, status, direction, fromNumber, clientId } = filters;

  const calledAt =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
          ...(dateTo ? { lte: new Date(dateTo) } : {}),
        }
      : undefined;

  const searchTerm = search ? String(search).trim() : "";

  const where = {
    organization_id: organizationId,
    ...(status ? { status } : {}),
    ...(direction ? { direction } : {}),
    ...(fromNumber ? { from_number: fromNumber } : {}),
    ...(clientId ? { client_id: String(clientId) } : {}),
    ...(calledAt ? { created_at: calledAt } : {}),
    ...(searchTerm
      ? {
          OR: [
            { from_number: { contains: searchTerm, mode: "insensitive" } },
            { to_number: { contains: searchTerm, mode: "insensitive" } },
            { twilio_call_sid: { contains: searchTerm, mode: "insensitive" } },
            {
              client: {
                OR: [
                  { first_name: { contains: searchTerm, mode: "insensitive" } },
                  { last_name: { contains: searchTerm, mode: "insensitive" } },
                  { phone: { contains: searchTerm, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    voiceCallRepository.countCalls(where),
    voiceCallRepository.findCalls({ where, skip, take: limitNum, orderBy }),
  ]);

  return {
    logs: items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * Resolves the "from" number against the org's enabled Twilio numbers, the
 * "to" number either directly or from a registered client, initiates the
 * Twilio call, and persists the resulting VoiceCallLog row - all inside a
 * single flow so a failed Twilio call never leaves an orphan log entry.
 */
export const createCall = async ({ organizationId, fromNumber, toNumber, clientId, createdBy }) => {
  if (!fromNumber || !String(fromNumber).trim()) {
    throw new Error("from_number is required");
  }
  if (!toNumber && !clientId) {
    throw new Error("Either to_number or client_id is required");
  }
  if (toNumber && clientId) {
    throw new Error("Provide either to_number or client_id, not both");
  }

  const configuration = await voiceConfigurationRepository.findConfigurationByOrgId(
    organizationId
  );
  if (!configuration) {
    throw new Error("Voice configuration not found for this organization");
  }

  // Older configurations may have stored numbers without a "+<country
  // code>" prefix, so normalize both sides before comparing - Twilio itself
  // would otherwise assume +1 (NANP) for a bare 10-digit number, which is
  // wrong for our (Indian) numbers.
  const normalizedFromNumber = normalizePhoneToE164(fromNumber);
  const fromNumberRecord = configuration.phoneNumbers.find(
    (n) => normalizePhoneToE164(n.phone_number) === normalizedFromNumber && n.status === "ENABLED"
  );
  if (!fromNumberRecord) {
    throw new Error("Selected from_number is not an enabled Twilio number for this organization");
  }

  let resolvedToNumber = toNumber ? normalizePhoneToE164(String(toNumber).trim()) : null;
  let resolvedClientId = null;

  if (clientId) {
    const client = await prisma.clients.findFirst({
      where: { id: String(clientId), is_valid: true },
      include: {
        client_organization_category: { where: { organization_id: organizationId } },
      },
    });
    if (!client) {
      throw new Error("Client not found");
    }
    if (!client.client_organization_category || client.client_organization_category.length === 0) {
      throw new Error("Client does not belong to this organization");
    }
    if (!client.phone) {
      throw new Error("Selected client does not have a mobile number on file");
    }
    resolvedToNumber = normalizePhoneToE164(client.phone);
    resolvedClientId = client.id;
  }

  if (!resolvedToNumber) {
    throw new Error("Unable to resolve destination number");
  }

  const webhookBaseUrl = getWebhookBaseUrl();
console.log("normalizedFromNumber", normalizedFromNumber);
console.log("resolvedToNumber", resolvedToNumber);
  const { callSid, status } = await TwilioVoiceService.initiateOutboundCall({
    accountSid: configuration.twilio_sid,
    authToken: configuration.twilio_token,
    fromNumber: normalizedFromNumber,
    toNumber: resolvedToNumber,
    statusCallbackUrl: `${webhookBaseUrl}/api/v1/voice/webhooks/call-status`,
    recordingStatusCallbackUrl: `${webhookBaseUrl}/api/v1/voice/webhooks/recording-status`,
  });
console.log("callSid", callSid);
console.log("status", status);
  const callLog = await voiceCallRepository.createCallLog({
    organization_id: organizationId,
    client_id: resolvedClientId,
    twilio_call_sid: callSid,
    from_number: normalizedFromNumber,
    to_number: resolvedToNumber,
    direction: "OUTBOUND",
    status: status || "QUEUED",
    created_by: createdBy || null,
  });

  return {
    id: callLog.id,
    twilio_call_sid: callLog.twilio_call_sid,
    status: callLog.status,
    from_number: callLog.from_number,
    to_number: callLog.to_number,
  };
};

/**
 * Twilio call-status webhook handler. Updates status + lifecycle timestamps
 * + duration. Silently no-ops for SIDs we don't recognise (e.g. test pings)
 * instead of throwing, so Twilio always gets a 200 and doesn't retry forever.
 */
export const handleStatusWebhook = async (payload) => {
  const twilioCallSid = payload.CallSid;
  if (!twilioCallSid) return null;

  const existing = await voiceCallRepository.findCallLogBySid(twilioCallSid);
  if (!existing) return null;

  const twilioStatus = String(payload.CallStatus || "").toLowerCase();
  const mappedStatus = TwilioVoiceService.mapTwilioCallStatus(twilioStatus);
  const now = new Date();

  const data = {};
  if (mappedStatus) data.status = mappedStatus;
  if (!existing.started_at) data.started_at = now;
  if (!existing.answered_at && twilioStatus === "in-progress") data.answered_at = now;

  const terminalStatuses = ["completed", "busy", "failed", "no-answer", "canceled"];
  if (terminalStatuses.includes(twilioStatus)) {
    data.ended_at = now;
    if (payload.CallDuration !== undefined) {
      const parsedDuration = parseInt(payload.CallDuration, 10);
      if (!Number.isNaN(parsedDuration)) data.duration_seconds = parsedDuration;
    }
  }

  if (Object.keys(data).length === 0) return existing;
  return voiceCallRepository.updateCallLogBySid(twilioCallSid, data);
};

/**
 * Streams a call recording's audio bytes for playback/download in the UI.
 * Twilio credentials are used server-side only here; the browser never
 * sees them, only the resulting audio buffer.
 */
export const getCallRecordingMedia = async ({ organizationId, callId }) => {
  const callLog = await voiceCallRepository.findCallLogById(callId, organizationId);
  if (!callLog) {
    throw new Error("Call log not found");
  }
  if (!callLog.recording_url) {
    throw new Error("No recording available for this call");
  }

  const configuration = await voiceConfigurationRepository.findConfigurationByOrgId(
    organizationId
  );
  if (!configuration) {
    throw new Error("Voice configuration not found for this organization");
  }

  const media = await TwilioVoiceService.fetchRecordingMedia({
    accountSid: configuration.twilio_sid,
    authToken: configuration.twilio_token,
    recordingUrl: callLog.recording_url,
  });

  return { ...media, filename: `${callLog.twilio_call_sid}.mp3` };
};

/**
 * Twilio recording-status webhook handler. Updates recording SID/URL only.
 */
export const handleRecordingWebhook = async (payload) => {
  const twilioCallSid = payload.CallSid;
  if (!twilioCallSid) return null;

  const existing = await voiceCallRepository.findCallLogBySid(twilioCallSid);
  if (!existing) return null;

  return voiceCallRepository.updateCallLogBySid(twilioCallSid, {
    recording_sid: payload.RecordingSid || null,
    recording_url: payload.RecordingUrl || null,
  });
};
