import { Router } from "express";
import adminRoutes from "./adminRoutes/index.js";
import noauthRoutes from "./noAuthRoutes/index.js";
import clientadmin from "./clientAdminRoutes/index.js";
import patientRoutes from "./patientRoutes/index.js";
import { loginMiddleware } from "../middleware/authMiddleware.js";
const router = Router();

router.use("/noAuth", noauthRoutes);
router.use("/clientadmin", loginMiddleware, clientadmin);
router.use("/patient", loginMiddleware, patientRoutes);
router.use("/admin", adminRoutes);

export default router;
