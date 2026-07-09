import prisma from "../prisma.js";
import { sendResponse, sendErrorResponse } from "../util/response.js";
import { syncWhatsappTemplatesForOrgs } from "../util/seedWhatsapp.js";

// ==========================================
// SUPER ADMIN ENDPOINTS
// ==========================================

// Get list of organizations with their WhatsApp metrics
export const getSAOrganizationsWhatsapp = async (req, res) => {
  try {
    const orgs = await prisma.organizations.findMany({
      where: { is_valid: true },
      select: {
        id: true,
        name: true,
        shortorgname: true,
        whatsapp_enabled: true,
        whatsapp_credits: true,
        _count: {
          select: {
            whatsapp_logs: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return sendResponse(
      res,
      {
        message: "Super Admin: Organization WhatsApp details retrieved successfully",
        data: orgs,
      },
      200
    );
  } catch (error) {
    console.error("Error fetching SA orgs WhatsApp settings:", error);
    return sendErrorResponse(res, error, 500);
  }
};

// Toggle WhatsApp enabled/disabled for an organization
export const toggleWhatsappForOrg = async (req, res) => {
  try {
    const { organizationId, enabled } = req.body;

    if (!organizationId) {
      return sendErrorResponse(res, new Error("organizationId is required"), 400);
    }

    const updatedOrg = await prisma.organizations.update({
      where: { id: organizationId },
      data: {
        whatsapp_enabled: enabled,
        updated_at: new Date(),
      },
    });

    // If enabling, sync the templates so they have toggles ready
    if (enabled) {
      await syncWhatsappTemplatesForOrgs();
    }

    return sendResponse(
      res,
      {
        message: `WhatsApp notifications successfully ${enabled ? "enabled" : "disabled"} for the organization.`,
        data: updatedOrg,
      },
      200
    );
  } catch (error) {
    console.error("Error toggling WhatsApp for org:", error);
    return sendErrorResponse(res, error, 500);
  }
};

// Add credit balance to an organization
export const addCreditsToOrg = async (req, res) => {
  try {
    const { organizationId, amount } = req.body;

    if (!organizationId || amount === undefined || amount === null) {
      return sendErrorResponse(res, new Error("organizationId and amount are required"), 400);
    }

    const creditsToAdd = parseFloat(amount);
    if (isNaN(creditsToAdd)) {
      return sendErrorResponse(res, new Error("Invalid credits amount format"), 400);
    }

    const updatedOrg = await prisma.organizations.update({
      where: { id: organizationId },
      data: {
        whatsapp_credits: {
          increment: creditsToAdd,
        },
        updated_at: new Date(),
      },
    });

    return sendResponse(
      res,
      {
        message: `Successfully credited ${creditsToAdd} credits.`,
        data: updatedOrg,
      },
      200
    );
  } catch (error) {
    console.error("Error adding credits to org:", error);
    return sendErrorResponse(res, error, 500);
  }
};

// View and update credit currency rate value setting (e.g. 1 credit = $X)
export const getGlobalCreditRate = async (req, res) => {
  try {
    let rate = await prisma.system_settings.findUnique({
      where: { key: "WHATSAPP_CREDIT_VALUE" },
    });

    if (!rate) {
      rate = await prisma.system_settings.create({
        data: { key: "WHATSAPP_CREDIT_VALUE", value: "1.0" },
      });
    }

    return sendResponse(
      res,
      {
        message: "Credit rate setting retrieved successfully",
        data: { creditValue: parseFloat(rate.value || "1.0") },
      },
      200
    );
  } catch (error) {
    console.error("Error getting credit rate:", error);
    return sendErrorResponse(res, error, 500);
  }
};

export const updateGlobalCreditRate = async (req, res) => {
  try {
    const { creditValue } = req.body;

    if (creditValue === undefined || creditValue === null) {
      return sendErrorResponse(res, new Error("creditValue is required"), 400);
    }

    const rate = await prisma.system_settings.upsert({
      where: { key: "WHATSAPP_CREDIT_VALUE" },
      update: { value: String(creditValue) },
      create: { key: "WHATSAPP_CREDIT_VALUE", value: String(creditValue) },
    });

    return sendResponse(
      res,
      {
        message: "Credit rate setting updated successfully",
        data: { creditValue: parseFloat(rate.value) },
      },
      200
    );
  } catch (error) {
    console.error("Error updating credit rate:", error);
    return sendErrorResponse(res, error, 500);
  }
};

// ==========================================
// CLIENT ADMIN (ORGANIZATION) ENDPOINTS
// ==========================================

// Get remaining credits and message count summary
export const getOrgWhatsappDashboard = async (req, res) => {
  try {
    const { organization_id } = req.query; // passed or extracted from token
    const orgId = organization_id || req.query.orgId;

    if (!orgId) {
      return sendErrorResponse(res, new Error("Organization ID is required"), 400);
    }

    const org = await prisma.organizations.findUnique({
      where: { id: orgId },
      select: { whatsapp_enabled: true, whatsapp_credits: true },
    });

    if (!org) {
      return sendErrorResponse(res, new Error("Organization not found"), 404);
    }

    // Get count statistics from logs
    const stats = await prisma.whatsapp_logs.groupBy({
      by: ["status"],
      where: { organization_id: orgId },
      _count: { id: true },
    });

    const counts = { SUCCESS: 0, FAILED: 0, PENDING: 0 };
    stats.forEach((s) => {
      if (counts[s.status] !== undefined) {
        counts[s.status] = s._count.id;
      }
    });

    // Get value of 1 credit
    const rateSetting = await prisma.system_settings.findUnique({
      where: { key: "WHATSAPP_CREDIT_VALUE" },
    });
    const creditValue = parseFloat(rateSetting?.value || "1.0");

    return sendResponse(
      res,
      {
        message: "Dashboard details retrieved successfully",
        data: {
          whatsappEnabled: org.whatsapp_enabled,
          whatsappCredits: org.whatsapp_credits,
          creditValue,
          statistics: counts,
        },
      },
      200
    );
  } catch (error) {
    console.error("Error fetching org dashboard details:", error);
    return sendErrorResponse(res, error, 500);
  }
};

// Get list of templates with toggle statuses for this organization
export const getOrgWhatsappTemplates = async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId) {
      return sendErrorResponse(res, new Error("Organization ID is required"), 400);
    }

    // Fetch all master templates
    const templates = await prisma.whatsapp_templates.findMany({
      where: { is_valid: true },
      orderBy: { name: "asc" },
    });

    // Fetch this organization's specific toggles
    const toggles = await prisma.whatsapp_templates_organizations.findMany({
      where: { organization_id: orgId },
    });

    const toggleMap = new Map(toggles.map((t) => [t.template_id, t.is_active]));

    const formatted = templates.map((t) => ({
      id: t.id,
      name: t.name,
      twilioTemplateName: t.twilio_template_name,
      body: t.body,
      creditCost: t.credit_cost,
      isActive: toggleMap.has(t.id) ? toggleMap.get(t.id) : false,
    }));

    return sendResponse(
      res,
      {
        message: "Organization templates retrieved successfully",
        data: formatted,
      },
      200
    );
  } catch (error) {
    console.error("Error fetching org WhatsApp templates:", error);
    return sendErrorResponse(res, error, 500);
  }
};

// Toggle template status (is_active) for organization
export const toggleOrgWhatsappTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { orgId, isActive } = req.body;

    if (!templateId || !orgId || isActive === undefined) {
      return sendErrorResponse(res, new Error("templateId, orgId, and isActive are required"), 400);
    }

    const updatedToggle = await prisma.whatsapp_templates_organizations.upsert({
      where: {
        template_id_organization_id: {
          template_id: templateId,
          organization_id: orgId,
        },
      },
      update: {
        is_active: isActive,
        updated_at: new Date(),
      },
      create: {
        template_id: templateId,
        organization_id: orgId,
        is_active: isActive,
      },
    });

    return sendResponse(
      res,
      {
        message: `Template successfully ${isActive ? "activated" : "deactivated"}.`,
        data: updatedToggle,
      },
      200
    );
  } catch (error) {
    console.error("Error toggling template for org:", error);
    return sendErrorResponse(res, error, 500);
  }
};

// Get credit usage history logs (with optional pagination, status, and client search filtering)
export const getOrgWhatsappLogs = async (req, res) => {
  try {
    const { orgId, status, search, page = 1, limit = 10 } = req.query;

    if (!orgId) {
      return sendErrorResponse(res, new Error("Organization ID is required"), 400);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Filters
    const where = {
      organization_id: orgId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { phone_number: { contains: search, mode: "insensitive" } },
        { template_name: { contains: search, mode: "insensitive" } },
        {
          clients: {
            OR: [
              { first_name: { contains: search, mode: "insensitive" } },
              { last_name: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    // Fetch total count for pagination
    const totalCount = await prisma.whatsapp_logs.count({ where });

    // Fetch logs
    const logs = await prisma.whatsapp_logs.findMany({
      where,
      include: {
        clients: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: limitNum,
    });

    const formatted = logs.map((l) => ({
      id: l.id,
      phoneNumber: l.phone_number,
      templateName: l.template_name,
      messageBody: l.message_body,
      twilioSid: l.twilio_sid,
      status: l.status,
      errorMessage: l.error_message,
      creditsDeducted: l.credits_deducted,
      createdAt: l.created_at,
      clientName: l.clients ? `${l.clients.first_name || ""} ${l.clients.last_name || ""}`.trim() : "N/A",
    }));

    return sendResponse(
      res,
      {
        message: "WhatsApp history logs retrieved successfully",
        data: {
          logs: formatted,
          pagination: {
            total: totalCount,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(totalCount / limitNum),
          },
        },
      },
      200
    );
  } catch (error) {
    console.error("Error fetching org WhatsApp logs:", error);
    return sendErrorResponse(res, error, 500);
  }
};
