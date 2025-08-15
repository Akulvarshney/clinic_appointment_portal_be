import { Router } from "express";
import resourceManagement from "./resourceManagementRoutes.js";
import serviceManagement from "./servicesManagementRoutes.js";
import usermgmtRoutes from "./usermgmtRoutes.js";
import dashboardRoutes from "../dashboardRoutes/dashboardRoutes.js"

const router = Router();

router.use("/userMgmt", usermgmtRoutes);
router.use("/resourceManagement", resourceManagement);
router.use("/serviceManagement", serviceManagement);
router.use("/getDashboardDetails", dashboardRoutes);

export default router;
