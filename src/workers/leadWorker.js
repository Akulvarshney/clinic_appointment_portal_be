import { Queue, Worker } from "bullmq";
import prisma from "../prisma.js";
import FacebookProvider from "../services/leadProviders/FacebookProvider.js";
import { emitNewLead } from "../services/socketService.js";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

export const leadQueue = new Queue("lead-processing", { connection });

const facebookProvider = new FacebookProvider();

const worker = new Worker(
  "lead-processing",
  async (job) => {
    const { provider, payload } = job.data;

    if (provider === "FACEBOOK") {
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (!value || !value.leadgen_id) {
        throw new Error("Invalid Facebook Webhook payload: Missing leadgen_id");
      }

      const { leadgen_id, page_id, form_id, created_time } = value;

      // Find the page in our DB to get access token and user_id
      const page = await prisma.facebook_pages.findUnique({
        where: { page_id },
        include: { integration: true },
      });

      if (!page) {
        console.warn(`Webhook received for untracked page_id: ${page_id}`);
        return;
      }

      // Check if lead already exists
      const existingLead = await prisma.leads.findUnique({
        where: { lead_id: leadgen_id },
      });

      if (existingLead) {
        console.log(`Lead ${leadgen_id} already exists, skipping.`);
        return;
      }

      // Fetch full lead details using Graph API
      const leadDetails = await facebookProvider.fetchLeadDetails(
        leadgen_id,
        page.page_access_token || page.integration.access_token
      );

      // Save to Database
      const newLead = await prisma.leads.create({
        data: {
          provider: "FACEBOOK",
          organization_id: page.integration.organization_id,
          facebook_page_id: page.id,
          lead_id: leadgen_id,
          full_name: leadDetails.fullName,
          email: leadDetails.email,
          phone: leadDetails.phone,
          form_name: "", // Can be fetched separately if needed
          form_id: form_id,
          campaign_name: leadDetails.campaignName,
          adset_name: leadDetails.adsetName,
          ad_name: leadDetails.adName,
          raw_payload: payload,
          created_time: leadDetails.createdTime,
        },
      });

      // Emit to connected clients via Socket.IO
      emitNewLead({
        ...newLead,
        page_name: page.page_name,
      });

      console.log(`✅ Processed and saved new lead: ${leadgen_id}`);
    }
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job.id} has failed with ${err.message}`);
});

export default worker;
