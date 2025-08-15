import { Router } from "express";

import {
  bookAppointmentController,
  getActiveAppointmentsController,
cancelAppointmentController,
changeAppointmentStatusController
} from "../../controller/appointmentController.js";

const router = Router();

router.post("/bookappointment", bookAppointmentController);
router.get("/getActiveAppointments", getActiveAppointmentsController);
router.patch("/changeAppointmentStatus",changeAppointmentStatusController)
router.post("/cancelAppointment",cancelAppointmentController )

export default router;
