import express from "express";
import { getPublicFeedbackController, submitPublicFeedbackController } from "../../controller/publicFeedbackController.js";

const router = express.Router();

router.get("/:feedbackId", getPublicFeedbackController);
router.post("/:feedbackId", submitPublicFeedbackController);

export default router;
