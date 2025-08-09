import { Router } from "express";
import {
  trackApplication,
  submitNewApplicationWithCheck,
} from "../../controller/newApplicationsController.js";
import {
  validateNewApplication,
  validateShortName,
  validateTrackApplication,
} from "../../validations/newApplicationValidations.js";

const router = Router();

router.post(
  "/submitApplication",
  validateNewApplication,
  submitNewApplicationWithCheck
);
router.get("/trackApplication", validateTrackApplication, trackApplication);

export default router;
