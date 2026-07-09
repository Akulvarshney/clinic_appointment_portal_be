import { Router } from "express";
import newApplicationRoute from "./newApplicationAdminRoutes.js";
import whatsappAdminRoute from "./whatsappAdminRoutes.js";

const router = Router();

router.use("/newApplication", newApplicationRoute);
router.use("/whatsapp", whatsappAdminRoute);

export default router;
