import { Router } from "express";

import {
  registerClientController,
  clientSearchController,
  clientListingConroller,
  clientDetailsController,
  updateClientController,
} from "../../controller/patientController.js";

const router = Router();

router.post("/registerClient", registerClientController);

router.get("/clientListing", clientListingConroller);
router.get("/clientSearch", clientSearchController);
router.get("/clientDetails/:clientId", clientDetailsController);
router.put("/editclientDetails/:userId", updateClientController);

export default router;
