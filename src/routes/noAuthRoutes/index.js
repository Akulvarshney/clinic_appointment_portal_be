import { Router } from "express";
import newApplicationRoute from "./newApplicationsRoutes.js";
import authRoutes from "./authRoutes.js";
import publicFeedbackRoutes from "./publicFeedbackRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/newApplication", newApplicationRoute);
router.use("/schedulerJob", newApplicationRoute);
router.use("/feedback", publicFeedbackRoutes);

export default router;
