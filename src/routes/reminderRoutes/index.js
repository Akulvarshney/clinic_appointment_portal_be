import { Router } from "express";

import {
  downloadRemindersController,
  getRemindersController,
  updateRemindersController,
  saveRemindersController,
} from "../../controller/reminderController.js";
const router = Router();

router.get("/getReminders", getRemindersController);
router.get("/downloadReminder", downloadRemindersController);
router.put("/updateReminder", updateRemindersController);
router.post("/saveReminder", saveRemindersController);

export default router;
