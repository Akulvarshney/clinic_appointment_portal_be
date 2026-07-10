import {
  getOrganizationDetailsForSA,
  getOrganizationAdminTabs,
  updateOrganizationAdminTabs,
} from "../services/organizationAdminService.js";
import { sendResponse, sendErrorResponse } from "../util/response.js";

export const getOrganizationDetailsForSAController = async (req, res) => {
  try {
    const { shortName } = req.params;
    if (!shortName) {
      return sendErrorResponse(res, "Organization shortName is required", 400);
    }
    const response = await getOrganizationDetailsForSA(shortName);
    sendResponse(res, { message: "Data fetched successfully", data: response }, 200);
  } catch (err) {
    console.error("Error in getOrganizationDetailsForSAController:", err);
    sendErrorResponse(res, err.message, 500);
  }
};

export const getOrganizationAdminTabsController = async (req, res) => {
  try {
    const { shortName } = req.params;
    if (!shortName) {
      return sendErrorResponse(res, "Organization shortName is required", 400);
    }
    const response = await getOrganizationAdminTabs(shortName);
    sendResponse(res, { message: "Tabs fetched successfully", data: response }, 200);
  } catch (err) {
    console.error("Error in getOrganizationAdminTabsController:", err);
    sendErrorResponse(res, err.message, 500);
  }
};

export const updateOrganizationAdminTabsController = async (req, res) => {
  try {
    const { shortName } = req.params;
    const { tabFeatureMapping } = req.body;
    
    if (!shortName) {
      return sendErrorResponse(res, "Organization shortName is required", 400);
    }
    if (!tabFeatureMapping || !Array.isArray(tabFeatureMapping)) {
      return sendErrorResponse(res, "tabFeatureMapping must be an array", 400);
    }

    const response = await updateOrganizationAdminTabs(shortName, tabFeatureMapping);
    sendResponse(res, { message: response }, 200);
  } catch (err) {
    console.error("Error in updateOrganizationAdminTabsController:", err);
    sendErrorResponse(res, err.message, 500);
  }
};
