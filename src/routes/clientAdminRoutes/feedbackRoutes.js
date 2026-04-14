import { Router } from "express";
import {
  createFeedbackController,
  getFeedbackController,
} from "../../controller/feedbackController.js";

const router = Router();

router.post("/createFeedback", createFeedbackController);
router.get("/getFeedback", getFeedbackController);

export default router;

