import { sendResponse } from "../util/response.js";
import { sendExcelDownload } from "../util/excelExport.js";
import {
  getReminderService,
  getRemindersDownloadData,
  updateReminderService,
  saveReminderService,
} from "../services/reminderService.js";

function getReminderDownloadTimestamp(date = new Date()) {
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

export const getRemindersController = async (req, res) => {
  try {
    const { orgId, date } = req.query;
    const response = await getReminderService(orgId, date);
    sendResponse(
      res,
      { message: "Getting Reminders Successfully", response, status: 200 },
      200
    );
  } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(500).json({ message: "Error: while getting records" });
  }
};

export const updateRemindersController = async (req, res) => {
  try {
    const { id } = req.query;
    const { remarks } = req.body;
    const response = await updateReminderService(id, remarks);
    sendResponse(res, { message: "Checked successfully" }, 200);
  } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const saveRemindersController = async (req, res) => {
  try {
    const { orgId, clientId, reminderdate, comments } = req.body;
    const response = await saveReminderService(
      orgId,
      clientId,
      reminderdate,
      comments
    );
    sendResponse(res, { message: "Reminder Saved Succesfully " }, 200);
  } catch (error) {
    console.log("Error here   ", error.message);
    res.status(500).json({ message: error.message });
  }
};

export const downloadRemindersController = async (req, res) => {
  try {
    const { orgId, fromDate, toDate } = req.query;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID (orgId) is required" });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({
        message: "fromDate and toDate are required",
      });
    }

    const result = await getRemindersDownloadData({
      orgId,
      fromDate,
      toDate,
    });

    sendExcelDownload(res, {
      filename: `reminders_${getReminderDownloadTimestamp()}`,
      sheetName: "Reminders",
      columns: [
        { header: "S.No", key: "serial_number", width: 10 },
        { header: "Client Name", key: "client_name", width: 24 },
        { header: "Portal ID", key: "portal_id", width: 16 },
        { header: "Phone", key: "phone", width: 16 },
        { header: "Reminder Date", key: "reminder_date", width: 16 },
        { header: "Status", key: "status", width: 14 },
        { header: "Comments", key: "comments", width: 36 },
        { header: "Completed Remarks", key: "completed_remarks", width: 36 },
        { header: "Created Date", key: "created_date", width: 16 },
      ],
      rows: result.rows,
    });
  } catch (error) {
    console.error("downloadRemindersController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};
