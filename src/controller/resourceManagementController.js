import { sendResponse } from "../util/response.js";
import {
  createResourceService,
  getResources,
  updateResourceService,
} from "../services/resourceManagementServices.js";
import { response } from "express";

export const createResourceController = async (req, res) => {
  try {
    const { resourceName, orgId } = req.body;
    const response = await createResourceService(resourceName, orgId);
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

export const getResourcesController = async (req, res) => {
  try {
    const { orgId,status } = req.query;
    const response = await getResources(orgId,status);
    sendResponse(
      res,
      { message: "Getting Resources Successfully", response, status: 200 },
      200
    );
  } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(401).json({ message: "Error: while getting records" });
  }
};

export const updateResourceController = async (req, res) => {
  try {
    const { id } = req.query;
    const { status } = req.body;
    const response = await updateResourceService(id, status);
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
