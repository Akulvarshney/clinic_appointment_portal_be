import prisma from "../prisma.js";
import {
  registerClientService,
  clientListingService,
  clientSearchService,
  clientSearchByIdService,
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
  const { search = "", orgId, limit } = req.query;

  try {
    const response = await clientSearchService(search, limit, orgId);
    res.json(response); // ✅ Send response to frontend
  } catch (error) {
    console.error("Error in client listing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const clientDetailsController = async (req, res) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    const client = await prisma.clients.findUnique({
      where: { id: clientId },
      include: {
        organizations: true, // fetch organization details
        users: true, // fetch user details
        categories: true, // fetch category details
        appointments: true, // fetch related appointments
      },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Client details retrieved successfully",
      data: client,
    });
  } catch (error) {
    console.error("Error fetching client details:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
