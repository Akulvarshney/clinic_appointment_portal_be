import { Router } from "express";
import newApplicationRoute from "./newApplicationsRoutes.js";
import authRoutes from "./authRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/newApplication", newApplicationRoute);
router.use("/schedulerJob", newApplicationRoute);

export default router;
