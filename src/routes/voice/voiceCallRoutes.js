import { Router } from "express";
import {
  getVoiceCallsController,
  createVoiceCallController,
  getVoiceCallRecordingController,
} from "../../controllers/voice/voiceCallController.js";
import {
  validateListCallsQuery,
  validateCreateCall,
} from "../../validators/voice/voiceCallValidators.js";

const router = Router();

router.get("/calls", validateListCallsQuery, getVoiceCallsController);
router.post("/calls", validateCreateCall, createVoiceCallController);
router.get("/calls/:id/recording", getVoiceCallRecordingController);

export default router;
