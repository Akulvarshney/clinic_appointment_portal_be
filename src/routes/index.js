import { Router } from "express";
import adminRoutes from "./adminRoutes/index.js";
import noauthRoutes from "./noAuthRoutes/index.js";
import clientadmin from "./clientAdminRoutes/index.js";
import patientRoutes from "./patientRoutes/index.js";
import appointmentRoutes from "./appointmentRoutes/index.js";
import { loginMiddleware } from "../middleware/authMiddleware.js";
import {
  generateInvoicePdf,
  generateThermalInvoicePdf,
} from "../controller/invoicePdfGeneratorController.js";
const router = Router();

router.get("/invoice/:billId", generateInvoicePdf);
router.get("/invoice2/:billId", generateThermalInvoicePdf);

router.use("/noAuth", noauthRoutes);
router.use("/clientadmin", loginMiddleware, clientadmin);
router.use("/patient", loginMiddleware, patientRoutes);
router.use("/admin", adminRoutes);
router.use("/appointments", loginMiddleware, appointmentRoutes);

export default router;
