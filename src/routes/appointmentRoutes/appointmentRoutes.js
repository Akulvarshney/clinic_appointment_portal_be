import { Router } from "express";

import {
  bookAppointmentController,
  getActiveAppointmentsController,
cancelAppointmentController,
changeAppointmentStatusController,
reScheduleAppointmentController
} from "../../controller/appointmentController.js";

const router = Router();

router.post("/bookappointment", bookAppointmentController);
router.get("/getActiveAppointments", getActiveAppointmentsController);
router.patch("/changeAppointmentStatus",changeAppointmentStatusController)
router.post("/cancelAppointment",cancelAppointmentController )
router.post("/rescheduleAppointments",reScheduleAppointmentController )

export default router;
