import { Router } from "express";
import {getKPIData , getPieChartData, getbarChartDataController} from "../../controller/dashboardController.js"
const router = Router();

router.get("/KPI",  getKPIData);
router.get("/barchart",  getbarChartDataController);
router.get("/PieChart",  getPieChartData);


export default router;