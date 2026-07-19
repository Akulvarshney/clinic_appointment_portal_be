import { Router } from "express";
import adminRoutes from "./adminRoutes/index.js";
import noauthRoutes from "./noAuthRoutes/index.js";
import clientadmin from "./clientAdminRoutes/index.js";
import patientRoutes from "./patientRoutes/index.js";
import appointmentRoutes from "./appointmentRoutes/index.js";
import voiceRoutes from "./voice/index.js";
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
router.use("/voice", voiceRoutes);

export default router;
