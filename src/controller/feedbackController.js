import { normalizeOrgId } from "../util/orgId.js";
import { sendErrorResponse, sendResponse } from "../util/response.js";
import { getFeedbackList } from "../services/feedbackService.js";



export async function getFeedbackController(req, res) {
  try {
    const {
      orgId,
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "desc",
      clientId,
      doctorId,
      employeeId,
      serviceId,
      experience,
      hasComplaint,
      from,
      to,
      search,
      type,
    } = req.query;

    const { ok, orgId: orgUuid } = normalizeOrgId(orgId);
    if (!ok) {
      return sendErrorResponse(res, "Valid orgId (organization UUID) is required", 400);
    }

    const data = await getFeedbackList({
      orgId: orgUuid,
      page,
      limit,
      sortBy,
      sortOrder,
      filters: {
        clientId,
        doctorId,
        employeeId,
        serviceId,
        experience,
        hasComplaint,
        from,
        to,
        search,
        type,
      },
    });

    return sendResponse(
      res,
      { message: "Feedback fetched successfully", data, status: 200 },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, error, 400);
  }
}

