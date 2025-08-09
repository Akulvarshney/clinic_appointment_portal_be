import { Router } from "express";

import {
  registerClientController,
  clientListingConroller,
} from "../../controller/patientController.js";

const router = Router();

router.post("/registerClient", registerClientController);

router.get("/clientListing", clientListingConroller);

export default router;
