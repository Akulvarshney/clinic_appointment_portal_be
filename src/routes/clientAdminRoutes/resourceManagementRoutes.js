import { Router } from "express";

import {
  createResourceController,
  getResourcesController,
  updateResourceController,
} from "../../controller/resourceManagementController.js";

const router = Router();

router.post("/createResource", createResourceController);
router.get("/getResources", getResourcesController);
router.patch("/updateResources", updateResourceController);
export default router;
