import {
  registerClientService,
  clientListingService,
  clientSearchService
} from "../services/patientService.js";
import { sendResponse } from "../util/response.js";

export const registerClientController = async (req, res) => {
  try {
    const {
      Firstname,
      Secondname,
      address,
      mobile,
      dob,
      gender,
      occupation,
      email,
      emergencyContact,
      category,
      organization_id,
      roleId,
    } = req.body;

    const response = await registerClientService(
      Firstname,
      Secondname,
      address,
      mobile,
      dob,
      gender,
      occupation,
      email,
      emergencyContact,
      category,
      organization_id,
      roleId
    );
    sendResponse(res, { message: response.message }, 200);
  } catch (error) {
    res.status(401).json({ message: error.message });
  }
};

// Controller
export const clientListingConroller = async (req, res) => {
  const { search = "", page = 1, limit = 10, orgId } = req.query;

  try {
    const response = await clientListingService(search, page, limit, orgId);
    res.json(response); // ✅ Send response to frontend
  } catch (error) {
    console.error("Error in client listing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


export const clientSearchController = async (req, res) => {
  const { search = "", orgId ,limit} = req.query;

  try {
    const response = await clientSearchService(search,  limit, orgId);
    res.json(response); // ✅ Send response to frontend
  } catch (error) {
    console.error("Error in client listing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
