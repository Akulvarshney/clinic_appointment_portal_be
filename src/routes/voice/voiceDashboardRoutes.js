import { Router } from "express";
import {
  getVoiceDashboardController,
  getVoiceDashboardExtendedController,
} from "../../controllers/voice/voiceDashboardController.js";
import { validateDashboardQuery } from "../../validators/voice/voiceCallValidators.js";

const router = Router();

router.get("/dashboard", validateDashboardQuery, getVoiceDashboardController);
router.get("/dashboard/extended", validateDashboardQuery, getVoiceDashboardExtendedController);

export default router;
