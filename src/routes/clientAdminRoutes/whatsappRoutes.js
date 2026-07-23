import { Router } from "express";
import * as whatsappCampaignController from "../../controller/whatsappCampaignController.js";
import {
  getOrgWhatsappDashboard,
  getOrgWhatsappTemplates,
  toggleOrgWhatsappTemplate,
  getOrgWhatsappLogs,
} from "../../controller/whatsappController.js";

const router = Router();

router.get("/dashboard", getOrgWhatsappDashboard);
router.get("/templates", getOrgWhatsappTemplates);
router.put("/templates/:templateId/toggle", toggleOrgWhatsappTemplate);
router.get("/logs", getOrgWhatsappLogs);

// Custom Templates (Bulk Messaging)

router.post(
  "/:organizationId/templates",
  whatsappCampaignController.requestCustomTemplate
);

router.get(
  "/:organizationId/templates",
  whatsappCampaignController.getCustomTemplates
);

// Campaigns
router.post(
  "/:organizationId/campaigns",
  whatsappCampaignController.scheduleCampaign
);

router.get(
  "/:organizationId/campaigns",
  whatsappCampaignController.getCampaigns
);

export default router;
