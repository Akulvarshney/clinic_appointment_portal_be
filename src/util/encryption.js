import crypto from "crypto";

/**
 * Generic, reversible encryption for sensitive credentials that must be
 * stored at rest but still read back in plaintext by our own backend code
 * (e.g. Twilio Account SID / Auth Token for the Voice Calls module). This is
 * NOT for passwords - those stay one-way hashed via util/password.js.
 *
 * AES-256-GCM is used because it is authenticated: any tampering with the
 * stored ciphertext is detected on decrypt instead of silently producing
 * garbage.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, recommended size for GCM
const KEY_ENV_VAR = "ENCRYPTION_KEY";

/**
 * Derives a 32-byte AES-256 key from the ENCRYPTION_KEY env var. Accepts
 * either a 64-character hex string (e.g. generated via `openssl rand -hex
 * 32`) or an arbitrary passphrase, which is hashed down to 32 bytes so any
 * reasonably strong secret works without extra setup.
 */
const getEncryptionKey = () => {
  const rawKey = process.env[KEY_ENV_VAR];
  if (!rawKey) {
    throw new Error(
      `${KEY_ENV_VAR} is not configured. It is required to encrypt/decrypt sensitive credentials (e.g. Twilio Account SID/Auth Token).`
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }
  return crypto.createHash("sha256").update(rawKey).digest();
};

/**
 * Encrypts a plaintext string into a single "iv:authTag:ciphertext" hex
 * string, safe to store in one DB column. Empty/nullish input passes
 * through unchanged so optional fields don't get encrypted into "".
 */
export const encryptSecret = (plainText) => {
  if (plainText === null || plainText === undefined || plainText === "") {
    return plainText;
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
};

/**
 * Reverses `encryptSecret`. Values that don't match the expected
 * "iv:authTag:ciphertext" shape (e.g. legacy plaintext rows saved before
 * encryption was introduced) are returned unchanged instead of throwing, so
 * existing data keeps working until it is next re-saved.
 */
export const decryptSecret = (storedValue) => {
  if (!storedValue) return storedValue;

  const parts = String(storedValue).split(":");
  if (parts.length !== 3) return storedValue;

  const [ivHex, authTagHex, encryptedHex] = parts;
  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Failed to decrypt stored secret:", error.message);
    return storedValue;
  }
};
