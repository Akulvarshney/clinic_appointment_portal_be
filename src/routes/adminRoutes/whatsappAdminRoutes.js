import { Router } from "express";
import {
  getSAOrganizationsWhatsapp,
  toggleWhatsappForOrg,
  addCreditsToOrg,
  getGlobalCreditRate,
  updateGlobalCreditRate,
} from "../../controller/whatsappController.js";

const router = Router();

router.get("/organizations", getSAOrganizationsWhatsapp);
router.post("/toggle", toggleWhatsappForOrg);
router.post("/add-credits", addCreditsToOrg);
router.get("/credit-rate", getGlobalCreditRate);
router.post("/credit-rate", updateGlobalCreditRate);

export default router;
