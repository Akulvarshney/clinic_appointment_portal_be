import { Router } from "express";
import apppointmentRoutes from "./appointmentRoutes.js";
import { loginMiddleware } from "../../middleware/authMiddleware.js";

const router = Router();

router.use("/appt", apppointmentRoutes);

export default router;
