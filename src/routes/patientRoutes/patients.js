import { Router } from "express";

import {
  registerClientController,
  clientSearchController,
  clientListingConroller,
  clientDetailsController,
} from "../../controller/patientController.js";

const router = Router();

router.post("/registerClient", registerClientController);

router.get("/clientListing", clientListingConroller);
router.get("/clientSearch", clientSearchController);
router.get("/clientDetails/:clientId", clientDetailsController);

export default router;
