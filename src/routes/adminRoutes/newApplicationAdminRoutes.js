import { Router } from "express";
import {
  getApplicationStausList,
  NewApplicationAction,
} from "../../controller/newApplicationsController.js";
import {
  validateStatus,
  validateApplicationAction,
} from "../../validations/newApplicationValidations.js";

const router = Router();

router.get("/getApplications/:status", validateStatus, getApplicationStausList); // Get liost based on status

router.post(
  "/applicationAction",
  validateApplicationAction,
  NewApplicationAction
);

router.post("/applicationAction", NewApplicationAction);

export default router;
