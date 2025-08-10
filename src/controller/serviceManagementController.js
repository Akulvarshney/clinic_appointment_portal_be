import { sendResponse } from "../util/response.js";
import {
  createServiceInfo,
  getServicesInfo,
  getActiveServicesInfo,
  updateServices
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
    const { orgId } = req.query;
    const response = await getServicesInfo(orgId);
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
    const { id } = req.query;
    const { status } = req.body;
    const response = await updateServices(id, status);
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
