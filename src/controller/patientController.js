import prisma from "../prisma.js";
import {
  registerClientService,
  clientListingService,
  clientSearchService,
  clientSearchByIdService,
  getClientsDownloadData,
} from "../services/patientService.js";
import { sendResponse } from "../util/response.js";
import { sendExcelDownload } from "../util/excelExport.js";

function getClientDownloadTimestamp(date = new Date()) {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}-${month}-${year}_${hours}:${minutes}`;
}
//SYNC
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
      state,
      city,
      country,
      pinCode,
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
      state,
      city,
      country,
      pinCode,
      emergencyContact,
      category,
      organization_id,
      roleId
    );
    sendResponse(res, { message: response.message }, 200);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Controller
export const clientListingConroller = async (req, res) => {
  const {
    search = "",
    page = 1,
    limit = 10,
    orgId,
    categoryId,
    sort,
    sortDir,
  } = req.query;

  try {
    const response = await clientListingService({
      search,
      page,
      limit,
      orgId,
      categoryId,
      sort,
      sortDir,
    });
    res.json(response);
  } catch (error) {
    console.error("Error in client listing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const downloadClientsController = async (req, res) => {
  try {
    const {
      search = "",
      orgId,
      categoryId,
      sort,
      sortDir,
      includeMobile,
    } = req.query;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID (orgId) is required" });
    }

    const showMobile = includeMobile === "true" || includeMobile === true;

    const result = await getClientsDownloadData({
      search,
      orgId,
      categoryId,
      sort,
      sortDir,
      includeMobile: showMobile,
    });

    sendExcelDownload(res, {
      filename: `clients_${getClientDownloadTimestamp()}`,
      sheetName: "Clients",
      columns: [
        { header: "S.No", key: "serial_number", width: 10 },
        { header: "Client ID", key: "portal_id", width: 18 },
        { header: "Name", key: "name", width: 26 },
        ...(showMobile ? [{ header: "Mobile", key: "phone", width: 16 }] : []),
        { header: "Email", key: "email", width: 28 },
        { header: "Gender", key: "gender", width: 12 },
        { header: "Date of Birth", key: "date_of_birth", width: 16 },
        { header: "Category", key: "category", width: 20 },
        { header: "Booked Status", key: "booked_status", width: 16 },
        { header: "Occupation", key: "occupation", width: 20 },
        { header: "Address", key: "address", width: 36 },
        { header: "City", key: "city", width: 16 },
        { header: "State", key: "state", width: 18 },
        { header: "Pin Code", key: "pin_code", width: 12 },
        { header: "Registered On", key: "registered_on", width: 16 },
      ],
      rows: result.rows,
    });
  } catch (error) {
    console.error("downloadClientsController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const clientSearchController = async (req, res) => {
  const { search = "", orgId, limit } = req.query;

  try {
    const response = await clientSearchService(search, limit, orgId);
    res.json(response);
  } catch (error) {
    console.error("Error in client listing:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const clientDetailsController = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { orgId } = req.query;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        message: "Client ID is required",
      });
    }

    const client = await prisma.clients.findUnique({
      where: { id: clientId },
      include: {
        users: true, // fetch linked user
        appointments: {
        include: {
          services: true, // 👈 this will fetch service details
        },
      },

        reminder: true, // fetch reminders
        client_organization_category: {
          where: orgId ? { organization_id: orgId } : {},
          include: {
            categories: true, // fetch categories
            organizations: true, // fetch organizations via mapping
          },
        },
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

export const updateClientBookedController = async (req, res) => {
  const { clientId, orgId, status, categoryId } = req.body;

  try {
    if (!clientId || typeof clientId !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid client ID" });
    }
    console.log("oasd", orgId, clientId);
    const existingStatus = await prisma.client_organization_category.findUnique(
      {
        where: {
          client_id_organization_id: {
            client_id: clientId,
            organization_id: orgId,
          },
        },
      }
    );
    console.log(!existingStatus);
    if (!existingStatus) {
      return res
        .status(400)
        .json({ success: false, message: "Record Not found" });
    }
    await prisma.client_organization_category.update({
      where: {
        id: existingStatus.id,
      },
      data: { booked_status: status },
    });

    return res.status(200).json({
      success: true,
      message: "Status changed Successfully",
    });
  } catch (error) {
    console.error("Error updating Status", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

export const updateClientController = async (req, res) => {
  const { userId } = req.params;
  const {
    orgId,
    first_name,
    last_name,
    phone,
    email,
    date_of_birth,
    address,
    gender,
    category,
    state,
  } = req.body;

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
          gender: gender,
          updated_at: new Date(),
          state: state ?? existingClient?.state,
        },
      }),
      prisma.client_organization_category.update({
        data: {
          category_id: category,
        },
        where: {
          client_id_organization_id: {
            client_id: existingClient.id,
            organization_id: orgId,
          },
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
