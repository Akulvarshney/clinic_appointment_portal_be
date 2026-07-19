import * as voiceConfigurationRepository from "../../repositories/voice/voiceConfigurationRepository.js";
import { normalizePhoneToE164 } from "../../util/phoneNumber.js";

/**
 * Business rules + orchestration for the org-level Voice (Twilio)
 * configuration: account credentials + the list of Twilio phone numbers
 * available to place calls from.
 */

/** Never let the Twilio auth token leave this service. */
const sanitizeConfiguration = (configuration) => {
  if (!configuration) return null;
  const { twilio_token, ...safe } = configuration;
  return safe;
};

const normalizePhoneNumbers = (phoneNumbers) => {
  if (!Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    throw new Error("At least one phone number is required");
  }

  const normalized = phoneNumbers.map((entry, index) => {
    const rawPhoneNumber = String(entry?.phoneNumber || entry?.phone_number || "").trim();
    if (!rawPhoneNumber) {
      throw new Error(`Phone number is required for entry ${index + 1}`);
    }
    return {
      id: entry?.id || undefined,
      phoneNumber: normalizePhoneToE164(rawPhoneNumber),
      friendlyName: entry?.friendlyName
        ? String(entry.friendlyName).trim()
        : entry?.friendly_name
        ? String(entry.friendly_name).trim()
        : null,
      status: entry?.status === "DISABLED" ? "DISABLED" : "ENABLED",
    };
  });

  const seen = new Set();
  for (const number of normalized) {
    const key = number.phoneNumber.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Phone number ${number.phoneNumber} is duplicated`);
    }
    seen.add(key);
  }

  return normalized;
};

/** Real Twilio Account SIDs always look like "AC" + 32 hex/alphanumeric chars. */
const TWILIO_SID_PATTERN = /^AC[a-zA-Z0-9]{32}$/;

/**
 * `requireToken` is true for first-time setup (no stored credentials yet)
 * and false for updates - the token is never returned by the API, so
 * updates must allow it to be omitted (the existing token is then kept).
 */
const validateAccountFields = ({ accountName, twilioSid, twilioToken }, { requireToken }) => {
  if (!accountName || !String(accountName).trim()) {
    throw new Error("Account name is required");
  }
  const trimmedSid = twilioSid ? String(twilioSid).trim() : "";
  if (!trimmedSid) {
    throw new Error("Twilio Account SID is required");
  }
  if (!TWILIO_SID_PATTERN.test(trimmedSid)) {
    throw new Error(
      "Twilio Account SID looks invalid - it must start with 'AC' and be 34 characters long, exactly as shown in your Twilio Console."
    );
  }
  if (requireToken && (!twilioToken || !String(twilioToken).trim())) {
    throw new Error("Twilio Auth Token is required");
  }
};

export const getConfiguration = async (organizationId) => {
  const configuration = await voiceConfigurationRepository.findConfigurationByOrgId(
    organizationId
  );
  return sanitizeConfiguration(configuration);
};

/** Internal helper for other voice services that legitimately need the token (e.g. TwilioVoiceService callers). */
export const getConfigurationWithCredentials = (organizationId) => {
  return voiceConfigurationRepository.findConfigurationByOrgId(organizationId);
};

export const createConfiguration = async ({
  organizationId,
  accountName,
  twilioSid,
  twilioToken,
  phoneNumbers,
  createdBy,
}) => {
  validateAccountFields({ accountName, twilioSid, twilioToken }, { requireToken: true });
  const normalizedNumbers = normalizePhoneNumbers(phoneNumbers);

  const existing = await voiceConfigurationRepository.findConfigurationByOrgId(
    organizationId
  );
  if (existing) {
    throw new Error(
      "Voice configuration already exists for this organization. Use update instead."
    );
  }

  const configuration = await voiceConfigurationRepository.createConfigurationWithNumbers({
    organizationId,
    accountName: String(accountName).trim(),
    twilioSid: String(twilioSid).trim(),
    twilioToken: String(twilioToken).trim(),
    phoneNumbers: normalizedNumbers,
    createdBy,
  });

  return sanitizeConfiguration(configuration);
};

export const updateConfiguration = async ({
  organizationId,
  accountName,
  twilioSid,
  twilioToken,
  phoneNumbers,
  updatedBy,
}) => {
  validateAccountFields({ accountName, twilioSid, twilioToken }, { requireToken: false });
  const normalizedNumbers = normalizePhoneNumbers(phoneNumbers);

  const existing = await voiceConfigurationRepository.findConfigurationByOrgId(
    organizationId
  );
  if (!existing) {
    throw new Error("Voice configuration not found for this organization");
  }

  // Any existing number id referenced in the payload must actually belong to
  // this organization's configuration (defense against cross-tenant ids).
  const existingIds = new Set(existing.phoneNumbers.map((n) => n.id));
  for (const number of normalizedNumbers) {
    if (number.id && !existingIds.has(number.id)) {
      throw new Error("One or more phone numbers do not belong to this configuration");
    }
  }

  // Blank token = "leave the stored Twilio Auth Token unchanged" (it is
  // never sent back to the frontend, so it can't be pre-filled/re-submitted).
  const trimmedToken = twilioToken ? String(twilioToken).trim() : "";

  const configuration = await voiceConfigurationRepository.updateConfigurationWithNumbers({
    configurationId: existing.id,
    accountName: String(accountName).trim(),
    twilioSid: String(twilioSid).trim(),
    twilioToken: trimmedToken || undefined,
    phoneNumbers: normalizedNumbers,
    updatedBy,
  });

  return sanitizeConfiguration(configuration);
};
