import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import prisma from "../prisma.js";
import { processAndSendWhatsappMessage } from "./whatsappSenderService.js";

// Initialize Redis connections for BullMQ (Must be separate for Queue and Worker)
const connectionOptions = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null, // Required by BullMQ
};

const redisConnectionQueue = new IORedis(connectionOptions);
const redisConnectionWorker = new IORedis(connectionOptions);

redisConnectionQueue.on("connect", () => {
  console.log("✅ Redis connected successfully for WhatsApp Queue");
});

// 1. Initialize BullMQ Queue
export const whatsappQueue = new Queue("whatsappQueue", {
  connection: redisConnectionQueue,
});

// 2. Initialize Worker to process jobs
const whatsappWorker = new Worker(
  "whatsappQueue",
  async (job) => {
    const { organizationId, clientId, templateName, params } = job.data;
    console.log(`[Worker] Processing WhatsApp Job ${job.id} for template: ${templateName}`);

    try {
      // 1. Fetch template details to get the Twilio Template ID (SID)
      const template = await prisma.whatsapp_templates.findUnique({
        where: { name: templateName },
      });

      if (!template || !template.is_valid) {
        // If template doesn't exist, we can just skip or throw to fail the job
        throw new Error(`Template '${templateName}' is not found or is disabled in system`);
      }

      console.log("asd", organizationId, template.twilio_template_id, params, clientId)

      // 2. Use the new sender function that handles all checks and logging internally
      await processAndSendWhatsappMessage({
        organizationId,
        twilio_template_id: template.twilio_template_id,
        variables: params,
        clientId
      });

    } catch (err) {
      console.error(`[Worker] Job ${job.id} failed:`, err.message);
      // Depending on BullMQ configuration, throwing an error here will cause retries
      throw err;
    }
  },
  {
    connection: redisConnectionWorker,
    concurrency: 5, // Process up to 5 jobs concurrently
  }
);

whatsappWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

whatsappWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});

// Function to helper-queue WhatsApp notification
export const queueWhatsappNotification = async ({
  organizationId,
  clientId,
  templateName,
  params = [],
}) => {
  try {
    const job = await whatsappQueue.add("sendWhatsapp", {
      organizationId,
      clientId,
      templateName,
      params,
    });
    console.log(`[Queue] Successfully enqueued WhatsApp job ${job.id} for template: ${templateName}`);
    return job;
  } catch (error) {
    console.error("[Queue] Failed to enqueue WhatsApp job:", error);
    throw error;
  }
};
