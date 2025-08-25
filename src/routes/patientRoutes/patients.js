import { Router } from "express";

import {
  registerClientController,
  clientSearchController,
  clientListingConroller,
  clientDetailsController,
  updateClientController,
  updateClientBookedController,
} from "../../controller/patientController.js";

const router = Router();

router.post("/registerClient", registerClientController);

router.get("/clientListing", clientListingConroller);
router.get("/clientSearch", clientSearchController);
router.get("/clientDetails/:clientId", clientDetailsController);
router.put("/editclientDetails/:userId", updateClientController);
router.put("/updateClientBookedStatus", updateClientBookedController);

export default router;
