import { Router } from "express";
import newApplicationRoute from "./newApplicationAdminRoutes.js";

const router = Router();

router.use("/newApplication", newApplicationRoute);

export default router;
