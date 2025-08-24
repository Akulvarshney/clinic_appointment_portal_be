import { sendResponse } from "../util/response.js";
import {
  getReminderService,
  updateReminderService,
  saveReminderService,
} from "../services/reminderService.js";

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
