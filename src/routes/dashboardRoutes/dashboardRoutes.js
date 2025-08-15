import { Router } from "express";
import {getKPIData } from "../../controller/dashboardController.js"
const router = Router();

router.get("/KPI",  getKPIData);


export default router;