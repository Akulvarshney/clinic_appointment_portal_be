import { sendResponse } from "../util/response.js";
import {
  createServiceInfo,
  getServicesInfo,
  getActiveServicesInfo,
  updateServices,
} from "../services/serviceManagementService.js";
export const createServiceController = async (req, res) => {
  try {
    const { serviceName, desc, price, orgId } = req.body;
    const response = await createServiceInfo(serviceName, desc, price, orgId);
    sendResponse(
      res,
      { message: response.message, status: response.status },
      200
    );
  } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(401).json({ message: error.message });
  }
};

export const getServicesController = async (req, res) => {
  try {
    const { orgId, page = 1, limit = 10, search = "", status } = req.query;

    if (!orgId) {
      return res.status(400).json({ message: "Organization ID is required" });
    }

    const result = await getServicesInfo({
      orgId,
      page: Number(page),
      limit: Number(limit),
      search,
      status,
    });

    return sendResponse(
      res,
      {
        message: "Services fetched successfully",
        data: result.data,
        status: 200,
      },
      200
    );
  } catch (error) {
    console.error("Error in getServicesController:", error);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getActiveServicesController = async (req, res) => {
  try {
    const { orgId } = req.query;
    const response = await getActiveServicesInfo(orgId);
    console.log("response.data", response.data);
    sendResponse(
      res,
      {
        message: "Getting Data Successfully",
        data: response.data,
        status: 200,
      },
      200
    );
  } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(401).json({ message: "Error: while getting records" });
  }
};

export const updateServicesController = async (req, res) => {
  try {
    const { id, serviceName, desc, price, orgId, status } = req.body;

    if (!id) {
      return res.status(400).json({ message: "Service ID is required" });
    }

    const response = await updateServices({
      id,
      serviceName,
      desc,
      price,
      orgId,
      status,
    });

    sendResponse(
      res,
      { message: "Service updated successfully", data: response },
      200
    );
  } catch (error) {
    console.error("Error in updateServicesController:", error.message);
    res.status(500).json({ message: error.message });
  }
};
