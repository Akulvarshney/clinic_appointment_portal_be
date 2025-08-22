import { sendResponse } from "../util/response.js";
import {
  getKPIDataService,
  getPieChartDataService,
  getBarChartDataService,
} from "../services/dashboardService.js";

export const getKPIData = async (req, res) => {
  const { orgId } = req.query;
  try {
    const response = await getKPIDataService(orgId);
    sendResponse(res, { message: "Getting Data successfully", response }, 200);
  } catch (err) {
    console.log("Error here   ", err.message);
    res.status(401).json({ message: "Error: while getting records" });
  }
};

export const getbarChartDataController = async (req, res) => {
  const { orgId } = req.query;
  try {
    const response = await getBarChartDataService(orgId);
    sendResponse(res, { message: "Getting Data successfully", response }, 200);
  } catch (err) {
    console.log("Error here   ", err.message);
    res.status(401).json({ message: "Error: while getting records" });
  }
};

export const getPieChartData = async (req, res) => {
  const { orgId, month, year } = req.query;
  try {
    const response = await getPieChartDataService(orgId, month, year);
    sendResponse(res, { message: "Getting Data Successfully", response }, 200);
  } catch (err) {
    console.log("Error herer.   ", err.message);
    res.status(401).json({ message: "Error: while getting records" });
  }
};
