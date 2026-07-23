import { Router } from "express";
import {
  getSAOrganizationsWhatsapp,
  toggleWhatsappForOrg,
  addCreditsToOrg,
  getGlobalCreditRate,
  updateGlobalCreditRate,
} from "../../controller/whatsappController.js";
import {
  getAllCustomTemplatesSA,
  approveCustomTemplate,
} from "../../controller/whatsappCampaignController.js";

const router = Router();

router.get("/organizations", getSAOrganizationsWhatsapp);
router.post("/toggle", toggleWhatsappForOrg);
router.post("/add-credits", addCreditsToOrg);
router.get("/credit-rate", getGlobalCreditRate);
router.post("/credit-rate", updateGlobalCreditRate);

router.get("/custom-templates", getAllCustomTemplatesSA);
router.put("/custom-templates/:templateId/approve", approveCustomTemplate);

export default router;
