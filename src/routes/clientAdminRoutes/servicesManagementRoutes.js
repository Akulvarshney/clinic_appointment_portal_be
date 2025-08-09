import { Router } from "express";
import { createResourceController } from "../../controller/resourceManagementController.js";
import {
  createServiceController,
  getServicesController,
  updateServicesController,
} from "../../controller/serviceManagementController.js";

const router = Router();

router.post("/createService", createServiceController);
router.get("/getServices", getServicesController);
router.patch("/updateService", updateServicesController);
export default router;
