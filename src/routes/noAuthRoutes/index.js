import { Router } from "express";
import newApplicationRoute from "./newApplicationsRoutes.js";
import authRoutes from "./authRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/newApplication", newApplicationRoute);

export default router;
