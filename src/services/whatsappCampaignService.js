import { Queue, Worker } from "bullmq";
import prisma from "../prisma.js";
import { createRedisConnection } from "../util/redisConnection.js";
import { whatsappQueue } from "./whatsappQueueService.js";

const redisConnectionQueue = createRedisConnection("campaign queue");
const redisConnectionWorker = createRedisConnection("campaign worker");

export const campaignQueue = new Queue("campaignQueue", {
  connection: redisConnectionQueue,
});

// Worker to process campaigns at scheduled time
const campaignWorker = new Worker(
  "campaignQueue",
  async (job) => {
    const { campaignId } = job.data;
    console.log(`[Campaign Worker] Processing campaign ${campaignId}`);

    const campaign = await prisma.whatsapp_campaigns.findUnique({
      where: { id: campaignId },
      include: {
        custom_template: true,
        organizations: true,
      },
    });

    if (!campaign || campaign.status !== "SCHEDULED") {
      console.log(`[Campaign Worker] Campaign ${campaignId} is either not found or already processed.`);
      return;
    }

    try {
      // Mark as IN_PROGRESS
      await prisma.whatsapp_campaigns.update({
        where: { id: campaignId },
        data: { status: "IN_PROGRESS", updated_at: new Date() },
      });

      let targets = [];
      const templateName = campaign.custom_template.template_name;
      const organizationId = campaign.organization_id;

      if (campaign.target_type === "ALL_CLIENTS") {
        const clients = await prisma.clients.findMany({
          where: { organization_id: organizationId, is_valid: true },
          select: { id: true, phone: true },
        });
        targets = clients.filter((c) => c.phone).map((c) => ({ clientId: c.id, phone: c.phone }));
      } else if (campaign.target_type === "SELECTED_CLIENTS") {
        const clientIds = campaign.target_data || [];
        const clients = await prisma.clients.findMany({
          where: { id: { in: clientIds }, organization_id: organizationId },
          select: { id: true, phone: true },
        });
        targets = clients.filter((c) => c.phone).map((c) => ({ clientId: c.id, phone: c.phone }));
      } else if (campaign.target_type === "EXCEL_UPLOAD") {
        // Assume target_data is an array of objects { phone: string } or array of strings
        const phoneList = campaign.target_data || [];
        targets = phoneList.map((p) => {
          return { clientId: null, phone: typeof p === "string" ? p : p.phone };
        });
      }

      console.log(`[Campaign Worker] Enqueueing ${targets.length} messages for campaign ${campaignId}`);

      for (const target of targets) {
        if (!target.phone) continue;
        
        await whatsappQueue.add("sendWhatsapp", {
          organizationId,
          clientId: target.clientId || null,
          appointmentId: null,
          templateName: templateName,
          params: [],
          customPhone: target.phone // We need to support custom phone if clientId is null
        });
      }

      await prisma.whatsapp_campaigns.update({
        where: { id: campaignId },
        data: { status: "COMPLETED", updated_at: new Date() },
      });

      console.log(`[Campaign Worker] Campaign ${campaignId} completed.`);
    } catch (error) {
      console.error(`[Campaign Worker] Campaign ${campaignId} failed:`, error);
      await prisma.whatsapp_campaigns.update({
        where: { id: campaignId },
        data: { status: "FAILED", updated_at: new Date() },
      });
    }
  },
  {
    connection: redisConnectionWorker,
    concurrency: 2,
  }
);

export const requestCustomTemplate = async (organizationId, payload) => {
  const { templateName, messageBody } = payload;
  
  // Create in custom_whatsapp_templates
  const template = await prisma.custom_whatsapp_templates.create({
    data: {
      organization_id: organizationId,
      template_name: templateName,
      message_body: messageBody,
      status: "PENDING",
    },
  });
  return template;
};

export const getCustomTemplates = async (organizationId) => {
  return await prisma.custom_whatsapp_templates.findMany({
    where: { organization_id: organizationId },
    orderBy: { created_at: "desc" },
  });
};

export const scheduleCampaign = async (organizationId, payload) => {
  const { customTemplateId, scheduledAt, targetType, targetData } = payload;
  
  const campaign = await prisma.whatsapp_campaigns.create({
    data: {
      organization_id: organizationId,
      custom_template_id: customTemplateId,
      scheduled_at: new Date(scheduledAt),
      target_type: targetType,
      target_data: targetData,
      status: "SCHEDULED",
    },
  });

  const delay = new Date(scheduledAt).getTime() - Date.now();
  
  await campaignQueue.add(
    "processCampaign",
    { campaignId: campaign.id },
    { delay: delay > 0 ? delay : 0 }
  );

  return campaign;
};

export const getCampaigns = async (organizationId) => {
  return await prisma.whatsapp_campaigns.findMany({
    where: { organization_id: organizationId },
    include: { custom_template: true },
    orderBy: { created_at: "desc" },
  });
};

// Admin API to approve a template (Creates it in global whatsapp_templates and maps it)
export const approveCustomTemplate = async (templateId, twilioTemplateId, creditCost = 1.0) => {
  return await prisma.$transaction(async (tx) => {
    const custom = await tx.custom_whatsapp_templates.findUnique({
      where: { id: templateId }
    });

    if (!custom) throw new Error("Template not found");

    // Create or update global template
    let globalTemplate = await tx.whatsapp_templates.findUnique({
      where: { name: custom.template_name }
    });

    if (!globalTemplate) {
      globalTemplate = await tx.whatsapp_templates.create({
        data: {
          name: custom.template_name,
          twilio_template_id: twilioTemplateId,
          body: custom.message_body,
          credit_cost: creditCost,
          is_valid: true
        }
      });
    }

    // Assign to organization and activate
    await tx.whatsapp_templates_organizations.upsert({
      where: {
        template_id_organization_id: {
          template_id: globalTemplate.id,
          organization_id: custom.organization_id
        }
      },
      update: { is_active: true },
      create: {
        template_id: globalTemplate.id,
        organization_id: custom.organization_id,
        is_active: true
      }
    });

    // Mark custom template as APPROVED
    return await tx.custom_whatsapp_templates.update({
      where: { id: templateId },
      data: { status: "APPROVED", twilio_template_id: twilioTemplateId, updated_at: new Date() }
    });
  });
};

export const getAllCustomTemplatesSA = async () => {
  return await prisma.custom_whatsapp_templates.findMany({
    include: {
      organizations: {
        select: {
          name: true,
          shortorgname: true
        }
      }
    },
    orderBy: { created_at: "desc" },
  });
};
