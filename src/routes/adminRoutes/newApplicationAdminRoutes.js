import { Router } from "express";
import {
  getApplicationStausList,
  NewApplicationAction,
} from "../../controller/newApplicationsController.js";
import {
  validateStatus,
  validateApplicationAction,
} from "../../validations/newApplicationValidations.js";
import {
  createNotification,
  getALLNotifications,
  changeNotificationStatusMaster,
} from "../../controller/notificationCenterController.js";

const router = Router();

router.get("/getApplications/:status", validateStatus, getApplicationStausList); // Get liost based on status

router.post(
  "/applicationAction",
  validateApplicationAction,
  NewApplicationAction
);

//super Admin Routes for Notification
router.post("/createNotification", createNotification);
router.get("/getSAnotifications", getALLNotifications);
router.patch("/changeNotificationStatus", changeNotificationStatusMaster);

export default router;
