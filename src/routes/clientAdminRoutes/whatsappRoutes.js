import { Router } from "express";
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

export default router;
