import prisma from "../prisma.js";
import {
  new_application_submit,
  checkStatus,
  getStatusList,
  NewApplicationActionService,
  checkShortNameService,
} from "../services/newApplicationService.js";
import { sendEmail } from "../util/sendMail.js";
import { sendTrackingTemplate } from "../util/emailTemplates.js";
import { sendResponse, sendErrorResponse } from "../util/response.js";

export const submitNewApplicationWithCheck = async (req, res) => {
  try {
    const { org_name, org_short_name, email, phone, client_name, address } =
      req.body;

    // Required field check
    if (!org_name || !org_short_name || !email || !phone || !client_name) {
      return sendErrorResponse(
        res,
        "All required fields must be provided.",
        400
      );
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendErrorResponse(res, "Invalid email format.", 400);
    }

    // Phone format check
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(phone)) {
      return sendErrorResponse(
        res,
        "Invalid mobile number. Must be 10 digits.",
        400
      );
    }

    // Check if short name already exists
    const existing = await prisma.organization_applications.findFirst({
      where: { org_short_name },
    });

    if (existing) {
      return sendErrorResponse(
        res,
        "Organization short name already exists.",
        400
      );
    }

    // Use transaction to create and send email
    const newApp = await prisma.$transaction(
      async (tx) => {
        const createdApp = await tx.organization_applications.create({
          data: {
            organization_name: org_name,
            org_short_name,
            email,
            phone,
            clientname: client_name,
            address,
          },
        });

        // Send email after creating
        const { subject, html, text } = sendTrackingTemplate(
          client_name,
          createdApp.trackingid
        );

        await sendEmail({ to: email, subject, html, text });

        return createdApp;
      },
      {
        timeout: 20000, // 20 seconds
      }
    );

    return sendResponse(
      res,
      {
        message: "Application submitted successfully.",
        trackingId: newApp.trackingid,
      },
      201
    );
  } catch (error) {
    return sendErrorResponse(
      res,
      error.message || "Internal Server Error",
      500
    );
  }
};

export const trackApplication = async (req, res) => {
  //const trackingId = req.params.trackingId;
  const { trackingId, mobileNumber } = req.query;
  try {
    const trackingid = parseInt(trackingId);
    const response = await checkStatus(trackingid, mobileNumber);
    console.log("res ", response);
    if (response.status === "PENDING") {
      response.message = "Status : Pending";
    } else if (response.status === "APPROVED") {
      response.message =
        "Status : Approved. Check Registered Email Id for Admin Credentials";
    } else if (response.status === "REJECTED") {
      response.message = "Status : Rejected";
    }
    sendResponse(
      res,
      { message: response.message, status: response.status },
      200
    );
  } catch (err) {
    console.log("2 ", err.message);
    res.status(401).json({ message: err.message });
  }
  //console.log("response received ", response);
};

export const getApplicationStausList = async (req, res) => {
  try {
    const status = req.params.status;
    // const status = req.params.status;
    const response = await getStatusList(status);
    //console.log("response received ", response);
    sendResponse(res, { message: "data fetched", data: response }, 200);
  } catch (err) {
    console.log(err);
    sendErrorResponse(res, { message: err }, 500);
  }
};

export const NewApplicationAction = async (req, res) => {
  try {
    const { id, Action, Remarks } = req.body;
    if (Action === "REJECTED" && (!Remarks || Remarks === "")) {
      return sendResponse(res, { message: "Remarks is mandatory" }, 400);
    }
    const response = await NewApplicationActionService(id, Action, Remarks);
    sendResponse(res, { message: response }, 200);
  } catch (err) {
    sendErrorResponse(res, { message: err.message }, 500);
  }
};

export const checkShortNameController = async (req, res) => {
  try {
    const { shortName } = req.query;
    const response = await checkShortNameService(shortName);
    console.log("response ", response);

    sendResponse(res, { message: response }, 200);
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: error.message });
  }
};
