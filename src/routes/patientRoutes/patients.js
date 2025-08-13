import { Router } from "express";

import {
  registerClientController,
  clientSearchController,
  clientListingConroller,
} from "../../controller/patientController.js";

const router = Router();

router.post("/registerClient", registerClientController);

router.get("/clientListing", clientListingConroller);
router.get("/clientSearch", clientSearchController);

export default router;
