import { Router } from "express";

import {
  bookAppointmentController,

} from "../../controller/appointmentController.js";

const router = Router();

router.post("/bookappointment", bookAppointmentController);
router.post("/getActiveAppointments", bookAppointmentController);
router.patch("/changeAppointmentStatus",bookAppointmentController)
router.post("/cancelAppointment",bookAppointmentController )

export default router;
