import { normalizeOrgId } from "../../util/orgId.js";
import { sendErrorResponse, sendResponse } from "../../util/response.js";
import * as VoiceCallService from "../../services/voice/VoiceCallService.js";

export const getVoiceCallsController = async (req, res) => {
  try {
    const {
      orgId,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
      search,
      dateFrom,
      dateTo,
      status,
      direction,
      fromNumber,
      clientId,
    } = req.query;

    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const data = await VoiceCallService.listCalls({
      organizationId: orgUuid,
      page,
      limit,
      sortBy,
      sortOrder,
      filters: { search, dateFrom, dateTo, status, direction, fromNumber, clientId },
    });

    return sendResponse(res, { message: "Call logs fetched successfully", data }, 200);
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};

/**
 * Streams the recording audio for a call. Kept as a proxy (rather than
 * redirecting to the raw Twilio media URL) so the org's Twilio Auth Token
 * never has to be exposed to, or used directly by, the browser.
 */
export const getVoiceCallRecordingController = async (req, res) => {
  try {
    const { id } = req.params;
    const { orgId, download } = req.query;

    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const { buffer, contentType, filename } = await VoiceCallService.getCallRecordingMedia({
      organizationId: orgUuid,
      callId: id,
    });

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `${download === "true" ? "attachment" : "inline"}; filename="${filename}"`
    );
    return res.send(buffer);
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};

export const createVoiceCallController = async (req, res) => {
  try {
    const { orgId, from_number, to_number, client_id } = req.body;
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const result = await VoiceCallService.createCall({
      organizationId: orgUuid,
      fromNumber: from_number,
      toNumber: to_number,
      clientId: client_id,
      createdBy: req.userId,
    });

    return sendResponse(res, { message: "Call initiated successfully", data: result }, 201);
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};
