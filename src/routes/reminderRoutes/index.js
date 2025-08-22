import { Router } from "express";

import {
  getRemindersController,
  updateRemindersController,
  saveRemindersController,
} from "../../controller/reminderController.js";
const router = Router();

router.get("/getReminders", getRemindersController);
router.put("/updateReminder", updateRemindersController);
router.post("/saveReminder", saveRemindersController);

export default router;
