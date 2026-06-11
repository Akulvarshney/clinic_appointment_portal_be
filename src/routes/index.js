import { Router } from "express";
import adminRoutes from "./adminRoutes/index.js";
import noauthRoutes from "./noAuthRoutes/index.js";
import clientadmin from "./clientAdminRoutes/index.js";
import patientRoutes from "./patientRoutes/index.js";
import appointmentRoutes from "./appointmentRoutes/index.js";
import facebookAuthRoutes from "./facebookAuth.js";
import webhookRoutes from "./webhooks.js";
import leadsRoutes from "./leads.js";
import { loginMiddleware } from "../middleware/authMiddleware.js";
import {
  generateInvoicePdf,
  generateReceiptPdf,
  generateThermalInvoicePdf,
  generateThermalReceiptPdf,
} from "../controller/invoicePdfGeneratorController.js";
const router = Router();

router.get("/invoice/:billId", generateInvoicePdf);
router.get("/invoice2/:billId", generateThermalInvoicePdf);

router.get("/receipt/:receiptId", generateReceiptPdf);
router.get("/receipt2/:receiptId", generateThermalReceiptPdf);

router.use("/noAuth", noauthRoutes);
router.use("/clientadmin", loginMiddleware, clientadmin);
router.use("/patient", loginMiddleware, patientRoutes);
router.use("/admin", adminRoutes);
router.use("/appointments", loginMiddleware, appointmentRoutes);

router.use("/facebook-auth", facebookAuthRoutes);
router.use("/facebook", webhookRoutes);
router.use("/leads", leadsRoutes);

export default router;
