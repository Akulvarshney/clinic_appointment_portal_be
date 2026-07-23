import * as whatsappCampaignService from "../services/whatsappCampaignService.js";

export const requestCustomTemplate = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { templateName, messageBody } = req.body;

    if (!templateName || !messageBody) {
      return res.status(400).json({ error: "templateName and messageBody are required." });
    }

    const template = await whatsappCampaignService.requestCustomTemplate(organizationId, {
      templateName,
      messageBody,
    });
    res.status(201).json(template);
  } catch (error) {
    console.error("Error in requestCustomTemplate:", error);
    res.status(500).json({ error: "Failed to request custom template" });
  }
};

export const getCustomTemplates = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const templates = await whatsappCampaignService.getCustomTemplates(organizationId);
    res.status(200).json(templates);
  } catch (error) {
    console.error("Error in getCustomTemplates:", error);
    res.status(500).json({ error: "Failed to fetch custom templates" });
  }
};

export const scheduleCampaign = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { customTemplateId, scheduledAt, targetType, targetData } = req.body;

    if (!customTemplateId || !scheduledAt || !targetType) {
      return res.status(400).json({ error: "customTemplateId, scheduledAt, and targetType are required." });
    }

    const campaign = await whatsappCampaignService.scheduleCampaign(organizationId, {
      customTemplateId,
      scheduledAt,
      targetType,
      targetData,
    });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("Error in scheduleCampaign:", error);
    res.status(500).json({ error: "Failed to schedule campaign" });
  }
};

export const getCampaigns = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const campaigns = await whatsappCampaignService.getCampaigns(organizationId);
    res.status(200).json(campaigns);
  } catch (error) {
    console.error("Error in getCampaigns:", error);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
};

export const approveCustomTemplate = async (req, res) => {
  try {
    // Note: In production, ensure this is protected so only Admin/Glorywellnic can call this
    const { templateId } = req.params;
    const { twilioTemplateId, creditCost } = req.body;

    if (!twilioTemplateId) {
      return res.status(400).json({ error: "twilioTemplateId is required" });
    }

    const updated = await whatsappCampaignService.approveCustomTemplate(templateId, twilioTemplateId, creditCost || 1.0);
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error in approveCustomTemplate:", error);
    res.status(500).json({ error: error.message || "Failed to approve custom template" });
  }
};

export const getAllCustomTemplatesSA = async (req, res) => {
  try {
    // Fetch all custom templates, including their organization details
    const templates = await whatsappCampaignService.getAllCustomTemplatesSA();
    res.status(200).json(templates);
  } catch (error) {
    console.error("Error in getAllCustomTemplatesSA:", error);
    res.status(500).json({ error: "Failed to fetch custom templates for SA" });
  }
};

