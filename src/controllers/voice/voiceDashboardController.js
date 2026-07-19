import { normalizeOrgId } from "../../util/orgId.js";
import { sendErrorResponse, sendResponse } from "../../util/response.js";
import * as VoiceDashboardService from "../../services/voice/VoiceDashboardService.js";

export const getVoiceDashboardController = async (req, res) => {
  try {
    const { orgId } = req.query;
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const dashboard = await VoiceDashboardService.getDashboard(orgUuid);

    return sendResponse(
      res,
      { message: "Voice dashboard fetched successfully", data: dashboard },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};

/**
 * Extended KPIs (this month + total till date) - only called when the user
 * expands "View More" on the dashboard, not on initial page load.
 */
export const getVoiceDashboardExtendedController = async (req, res) => {
  try {
    const { orgId } = req.query;
    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const extended = await VoiceDashboardService.getExtendedDashboard(orgUuid);

    return sendResponse(
      res,
      { message: "Extended voice dashboard fetched successfully", data: extended },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
};
