import { Router } from "express";
import { createResourceController } from "../../controller/resourceManagementController.js";
import {
  createServiceController,
  getServicesController,
  updateServicesController,
  getActiveServicesController,
} from "../../controller/serviceManagementController.js";

const router = Router();

router.post("/createService", createServiceController);
router.get("/getServices", getServicesController);
router.put("/updateService", updateServicesController);
router.get("/getActiveServices", getActiveServicesController);

export default router;
