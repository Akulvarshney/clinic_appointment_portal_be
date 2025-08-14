import { Router } from "express";

import {
  bookAppointmentController,
  getActiveAppointmentsController

} from "../../controller/appointmentController.js";

const router = Router();

router.post("/bookappointment", bookAppointmentController);
router.get("/getActiveAppointments", getActiveAppointmentsController);
router.patch("/changeAppointmentStatus",bookAppointmentController)
router.post("/cancelAppointment",bookAppointmentController )

export default router;
