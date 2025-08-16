import { Router } from "express";
import {getKPIData , getPieChartData} from "../../controller/dashboardController.js"
const router = Router();

router.get("/KPI",  getKPIData);
router.get("/PieChart",  getPieChartData);


export default router;