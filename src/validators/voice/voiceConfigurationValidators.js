import { check } from "express-validator";
import { handleValidationErrors } from "../../middleware/handleValidationErrors.js";

export const validateVoiceConfigurationQuery = [
  check("orgId").notEmpty().withMessage("orgId is required"),
  handleValidationErrors,
];

/** Used for POST (first-time setup) - the Twilio Auth Token must be provided. */
export const validateVoiceConfigurationCreatePayload = [
  check("orgId").notEmpty().withMessage("orgId is required"),
  check("accountName").notEmpty().withMessage("Account Name is required"),
  check("twilioSid").notEmpty().withMessage("Twilio Account SID is required"),
  check("twilioToken").notEmpty().withMessage("Twilio Auth Token is required"),
  check("phoneNumbers")
    .isArray({ min: 1 })
    .withMessage("At least one phone number is required"),
  check("phoneNumbers.*.phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required for every entry"),
  handleValidationErrors,
];

/**
 * Used for PUT (updates) - the Twilio Auth Token is never returned by the
 * API, so it must stay optional here: leaving it blank keeps the previously
 * stored token unchanged instead of forcing it to be re-entered for every
 * unrelated change (e.g. adding a phone number).
 */
export const validateVoiceConfigurationUpdatePayload = [
  check("orgId").notEmpty().withMessage("orgId is required"),
  check("accountName").notEmpty().withMessage("Account Name is required"),
  check("twilioSid").notEmpty().withMessage("Twilio Account SID is required"),
  check("twilioToken").optional({ checkFalsy: true }).isString(),
  check("phoneNumbers")
    .isArray({ min: 1 })
    .withMessage("At least one phone number is required"),
  check("phoneNumbers.*.phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required for every entry"),
  handleValidationErrors,
];
