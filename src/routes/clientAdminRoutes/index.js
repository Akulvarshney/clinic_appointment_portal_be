import { Router } from "express";
import resourceManagement from "./resourceManagementRoutes.js";
import serviceManagement from "./servicesManagementRoutes.js";
import usermgmtRoutes from "./usermgmtRoutes.js";
import dashboardRoutes from "../dashboardRoutes/dashboardRoutes.js";
import reminderRoutes from "../reminderRoutes/index.js";
import invoiceRoutes from "./invoiceManagementRoutes.js";
import receiptRoutes from "./receiptManagementRoutes.js";
import inventoryRoutes from "./inventoryManagementRoutes.js";
import feedbackRoutes from "./feedbackRoutes.js";
import whatsappRoutes from "./whatsappRoutes.js";

const router = Router();

router.use("/userMgmt", usermgmtRoutes);
router.use("/resourceManagement", resourceManagement);
router.use("/serviceManagement", serviceManagement);
router.use("/getDashboardDetails", dashboardRoutes);
router.use("/reminderManagement", reminderRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/receipts", receiptRoutes);
router.use("/inventoryManagement", inventoryRoutes);
router.use("/feedback", feedbackRoutes);
router.use("/whatsapp", whatsappRoutes);

export default router;
