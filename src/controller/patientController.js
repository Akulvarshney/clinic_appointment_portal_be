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
  const { search = "", page = 1, limit = 10, orgId, categoryId } = req.query;

  try {
    const response = await clientListingService({
      search,
      page,
      limit,
      orgId,
      categoryId,
    });
    res.json(response);
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

export const updateClientController = async (req, res) => {
  const { userId } = req.params;
  const { first_name, last_name, phone, email, date_of_birth, address } =
    req.body;

  try {
    if (!userId || typeof userId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const existingClient = await prisma.clients.findUnique({
      where: { userid: userId },
      include: { users: true },
    });

    if (!existingClient) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found for this user" });
    }

    const [updatedClient, updatedUser] = await prisma.$transaction([
      prisma.clients.update({
        where: { userid: userId },
        data: {
          first_name: first_name ?? existingClient.first_name,
          last_name: last_name ?? existingClient.last_name,
          phone: phone ?? existingClient.phone,
          email: email ?? existingClient.email,
          date_of_birth: date_of_birth
            ? new Date(date_of_birth)
            : existingClient.date_of_birth,
          address: address ?? existingClient.address,
          updated_at: new Date(),
        },
      }),
      prisma.users.update({
        where: { id: userId },
        data: {
          full_name: `${first_name ?? existingClient.first_name} ${
            last_name ?? existingClient.last_name
          }`.trim(),
          phone: phone ?? existingClient.users.phone,
          email: email ?? existingClient.users.email,
          updated_at: new Date(),
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Client & User profile updated successfully",
      data: { client: updatedClient, user: updatedUser },
    });
  } catch (error) {
    console.error("Error updating client & user:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};
