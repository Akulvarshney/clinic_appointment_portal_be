/**
 * Twilio requires phone numbers in E.164 format ("+<countrycode><number>").
 * When a number is submitted without a leading "+", Twilio does not reject
 * it - it silently assumes the North American (+1) country code, because
 * NANP numbers also happen to be 10 digits. This CRM's numbers are Indian,
 * so a bare 10-digit number (e.g. "9217306180") must default to +91, not
 * the Twilio-assumed +1, otherwise calls get dialed against the wrong
 * country entirely.
 */
const DEFAULT_COUNTRY_CODE = "+91";

/**
 * Normalizes a phone number to E.164 format, defaulting to India's country
 * code for numbers that don't already specify one.
 */
export const normalizePhoneToE164 = (rawNumber, defaultCountryCode = DEFAULT_COUNTRY_CODE) => {
  if (!rawNumber) return rawNumber;

  let value = String(rawNumber).trim().replace(/[\s()-]/g, "");
  if (!value) return value;

  if (value.startsWith("+")) {
    return value;
  }

  if (value.startsWith("00")) {
    return `+${value.slice(2)}`;
  }

  const countryDigits = defaultCountryCode.replace("+", "");
  if (value.startsWith(countryDigits) && value.length === countryDigits.length + 10) {
    return `+${value}`;
  }

  // Drop a local trunk-prefix "0" (e.g. "09217306180" -> "9217306180").
  value = value.replace(/^0+/, "");

  return `${defaultCountryCode}${value}`;
};
