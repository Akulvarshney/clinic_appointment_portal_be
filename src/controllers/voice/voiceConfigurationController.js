import { normalizeOrgId } from "../../util/orgId.js";
import { sendErrorResponse, sendResponse } from "../../util/response.js";
import * as VoiceConfigurationService from "../../services/voice/VoiceConfigurationService.js";

export const getVoiceConfigurationController = async (req, res) => {
  try {
    const { orgId } = req.query;
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const configuration = await VoiceConfigurationService.getConfiguration(orgUuid);

    return sendResponse(
      res,
      { message: "Voice configuration fetched successfully", data: configuration },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};

export const createVoiceConfigurationController = async (req, res) => {
  try {
    const { orgId, accountName, twilioSid, twilioToken, phoneNumbers } = req.body;
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const configuration = await VoiceConfigurationService.createConfiguration({
      organizationId: orgUuid,
      accountName,
      twilioSid,
      twilioToken,
      phoneNumbers,
      createdBy: req.userId,
    });

    return sendResponse(
      res,
      { message: "Voice configuration created successfully", data: configuration },
      201
    );
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};

export const updateVoiceConfigurationController = async (req, res) => {
  try {
    const { orgId, accountName, twilioSid, twilioToken, phoneNumbers } = req.body;
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const configuration = await VoiceConfigurationService.updateConfiguration({
      organizationId: orgUuid,
      accountName,
      twilioSid,
      twilioToken,
      phoneNumbers,
      updatedBy: req.userId,
    });

    return sendResponse(
      res,
      { message: "Voice configuration updated successfully", data: configuration },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};
