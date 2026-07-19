import prisma from "../../prisma.js";
import { encryptSecret, decryptSecret } from "../../util/encryption.js";

/**
 * Data-access layer for the Voice Calls configuration (Twilio account +
 * phone numbers). Kept free of business rules - validation/orchestration
 * belongs in services/voice/VoiceConfigurationService.js.
 *
 * `twilio_sid` / `twilio_token` are encrypted at rest: every write here
 * encrypts them before hitting the DB, and every read decrypts them before
 * returning, so callers elsewhere in the codebase always work with
 * plaintext values and never need to know about the encryption.
 */

const decryptConfiguration = (configuration) => {
  if (!configuration) return configuration;
  return {
    ...configuration,
    twilio_sid: decryptSecret(configuration.twilio_sid),
    twilio_token: decryptSecret(configuration.twilio_token),
  };
};

export const findConfigurationByOrgId = async (organizationId) => {
  const configuration = await prisma.organizationVoiceConfiguration.findUnique({
    where: { organization_id: organizationId },
    include: {
      phoneNumbers: { orderBy: { created_at: "asc" } },
    },
  });
  return decryptConfiguration(configuration);
};

export const findConfigurationById = async (id) => {
  const configuration = await prisma.organizationVoiceConfiguration.findUnique({
    where: { id },
    include: {
      phoneNumbers: { orderBy: { created_at: "asc" } },
    },
  });
  return decryptConfiguration(configuration);
};

export const createConfigurationWithNumbers = ({
  organizationId,
  accountName,
  twilioSid,
  twilioToken,
  phoneNumbers,
  createdBy,
}) => {
  return prisma.$transaction(async (tx) => {
    const configuration = await tx.organizationVoiceConfiguration.create({
      data: {
        organization_id: organizationId,
        account_name: accountName,
        twilio_sid: encryptSecret(twilioSid),
        twilio_token: encryptSecret(twilioToken),
        created_by: createdBy || null,
        updated_by: createdBy || null,
      },
    });

    await tx.organizationVoiceNumber.createMany({
      data: phoneNumbers.map((number) => ({
        configuration_id: configuration.id,
        phone_number: number.phoneNumber,
        friendly_name: number.friendlyName || null,
        status: number.status || "ENABLED",
      })),
    });

    const full = await tx.organizationVoiceConfiguration.findUnique({
      where: { id: configuration.id },
      include: { phoneNumbers: { orderBy: { created_at: "asc" } } },
    });
    return decryptConfiguration(full);
  });
};

/**
 * Replaces account fields and reconciles the phone number list in a single
 * transaction: existing numbers (identified by id) are updated, numbers not
 * present in the incoming list are removed, and numbers without an id are
 * created as new entries.
 */
export const updateConfigurationWithNumbers = ({
  configurationId,
  accountName,
  twilioSid,
  twilioToken,
  phoneNumbers,
  updatedBy,
}) => {
  return prisma.$transaction(async (tx) => {
    await tx.organizationVoiceConfiguration.update({
      where: { id: configurationId },
      data: {
        account_name: accountName,
        twilio_sid: encryptSecret(twilioSid),
        // Omitted (undefined) when the caller wants to keep the existing
        // token unchanged - Prisma skips fields that are `undefined`.
        ...(twilioToken ? { twilio_token: encryptSecret(twilioToken) } : {}),
        updated_by: updatedBy || null,
      },
    });

    const existingNumbers = await tx.organizationVoiceNumber.findMany({
      where: { configuration_id: configurationId },
      select: { id: true },
    });
    const existingIds = new Set(existingNumbers.map((n) => n.id));
    const incomingIds = new Set(
      phoneNumbers.filter((n) => n.id).map((n) => n.id)
    );

    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (idsToDelete.length > 0) {
      await tx.organizationVoiceNumber.deleteMany({
        where: { id: { in: idsToDelete } },
      });
    }

    for (const number of phoneNumbers) {
      if (number.id && existingIds.has(number.id)) {
        await tx.organizationVoiceNumber.update({
          where: { id: number.id },
          data: {
            phone_number: number.phoneNumber,
            friendly_name: number.friendlyName || null,
            status: number.status || "ENABLED",
          },
        });
      } else {
        await tx.organizationVoiceNumber.create({
          data: {
            configuration_id: configurationId,
            phone_number: number.phoneNumber,
            friendly_name: number.friendlyName || null,
            status: number.status || "ENABLED",
          },
        });
      }
    }

    const full = await tx.organizationVoiceConfiguration.findUnique({
      where: { id: configurationId },
      include: { phoneNumbers: { orderBy: { created_at: "asc" } } },
    });
    return decryptConfiguration(full);
  });
};

export const findEnabledNumbers = (configurationId) => {
  return prisma.organizationVoiceNumber.findMany({
    where: { configuration_id: configurationId, status: "ENABLED" },
    orderBy: { created_at: "asc" },
  });
};

export const findNumberByPhone = (configurationId, phoneNumber, excludeId) => {
  return prisma.organizationVoiceNumber.findFirst({
    where: {
      configuration_id: configurationId,
      phone_number: phoneNumber,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
};
