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
import {
  getOrganizationDetailsForSAController,
  getOrganizationAdminTabsController,
  updateOrganizationAdminTabsController,
} from "../../controller/organizationAdminController.js";

const router = Router();

router.get("/organizationDetails/:shortName", getOrganizationDetailsForSAController);
router.get("/organizationAdminTabs/:shortName", getOrganizationAdminTabsController);
router.put("/organizationAdminTabs/:shortName", updateOrganizationAdminTabsController);

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
