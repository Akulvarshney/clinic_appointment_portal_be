import { Router } from "express";
import { loginMiddleware } from "../../middleware/authMiddleware.js";
import voiceConfigurationRoutes from "./voiceConfigurationRoutes.js";
import voiceCallRoutes from "./voiceCallRoutes.js";
import voiceDashboardRoutes from "./voiceDashboardRoutes.js";
import voiceWebhookRoutes from "./voiceWebhookRoutes.js";

const router = Router();

// Twilio webhooks must stay publicly reachable (Twilio cannot send a JWT).
// They are authenticated via Twilio's request signature instead - see
// controllers/voice/voiceWebhookController.js.
router.use("/webhooks", voiceWebhookRoutes);

// Everything else is scoped to the logged-in user's organization.
router.use("/", loginMiddleware, voiceConfigurationRoutes);
router.use("/", loginMiddleware, voiceCallRoutes);
router.use("/", loginMiddleware, voiceDashboardRoutes);

export default router;
