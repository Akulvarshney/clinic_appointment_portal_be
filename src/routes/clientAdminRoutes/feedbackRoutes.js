import { Router } from "express";
import { getFeedbackController } from "../../controller/feedbackController.js";

const router = Router();


router.get("/getFeedback", getFeedbackController);

export default router;

