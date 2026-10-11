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
import surveyAdminRoutes from "./surveyAdminRoutes.js";
import {
  resetPasswordController,
  resetEmployeePasswordController,
  getDefaultPasswordController,
} from "../../controller/userMgmtController.js";

const router = Router();

router.post("/resetpassword", resetPasswordController);
router.post("/resetEmployeePassword", resetEmployeePasswordController);
router.get("/getDefaultPassword", getDefaultPasswordController);
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
router.use("/survey", surveyAdminRoutes);

export default router;
