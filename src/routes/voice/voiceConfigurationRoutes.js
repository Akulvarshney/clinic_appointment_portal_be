import { Router } from "express";
import {
  getVoiceConfigurationController,
  createVoiceConfigurationController,
  updateVoiceConfigurationController,
} from "../../controllers/voice/voiceConfigurationController.js";
import {
  validateVoiceConfigurationQuery,
  validateVoiceConfigurationCreatePayload,
  validateVoiceConfigurationUpdatePayload,
} from "../../validators/voice/voiceConfigurationValidators.js";

const router = Router();

router.get("/configuration", validateVoiceConfigurationQuery, getVoiceConfigurationController);
router.post(
  "/configuration",
  validateVoiceConfigurationCreatePayload,
  createVoiceConfigurationController
);
router.put(
  "/configuration",
  validateVoiceConfigurationUpdatePayload,
  updateVoiceConfigurationController
);

export default router;
