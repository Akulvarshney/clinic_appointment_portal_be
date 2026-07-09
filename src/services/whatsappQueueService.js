import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import twilio from "twilio";
import prisma from "../prisma.js";

// Initialize Redis connection for BullMQ
const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null, // Required by BullMQ
});

redisConnection.on("connect", () => {
  console.log("✅ Redis connected successfully for WhatsApp Queue");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis connection error for WhatsApp Queue:", err);
});

// Twilio Client Setup
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    console.warn("⚠️ Twilio credentials missing in environment variables");
    return null;
  }
  return twilio(accountSid, authToken);
};

// 1. Initialize BullMQ Queue
export const whatsappQueue = new Queue("whatsappQueue", {
  connection: redisConnection,
});

// Helper to replace placeholders like {{1}}, {{2}} with actual parameters
const formatTemplateBody = (body, params = []) => {
  let formatted = body;
  params.forEach((val, index) => {
    formatted = formatted.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, "g"), val || "");
  });
  return formatted;
};

// Helper to format phone number to E.164 standard (e.g. +91XXXXXXXXXX)
const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, ""); // remove non-digits
  if (clean.length === 10) {
    return `+91${clean}`; // default to India code if 10 digit, adjust as needed
  }
  return `+${clean}`;
};

// 2. Initialize Worker to process jobs
const whatsappWorker = new Worker(
  "whatsappQueue",
  async (job) => {
    const { organizationId, clientId, appointmentId, templateName, params } = job.data;
    console.log(`[Worker] Processing WhatsApp Job ${job.id} for template: ${templateName}`);

    // Create a pending log entry first
    let logEntry = await prisma.whatsapp_logs.create({
      data: {
        organization_id: organizationId,
        client_id: clientId || null,
        appointment_id: appointmentId || null,
        phone_number: "", // will update shortly
        template_name: templateName,
        message_body: "",
        status: "PENDING",
        credits_deducted: 0,
      },
    });

    try {
      // 1. Check organization settings
      const org = await prisma.organizations.findUnique({
        where: { id: organizationId },
        select: { whatsapp_enabled: true, whatsapp_credits: true },
      });

      if (!org) {
        throw new Error("Organization not found");
      }

      if (!org.whatsapp_enabled) {
        throw new Error("WhatsApp feature is disabled for this organization");
      }

      // 2. Fetch template details
      const template = await prisma.whatsapp_templates.findUnique({
        where: { name: templateName },
      });

      if (!template || !template.is_valid) {
        throw new Error(`Template '${templateName}' is not found or is disabled in system`);
      }

      // 3. Check organization level toggle for this template
      const orgToggle = await prisma.whatsapp_templates_organizations.findUnique({
        where: {
          template_id_organization_id: {
            template_id: template.id,
            organization_id: organizationId,
          },
        },
      });

      if (!orgToggle || !orgToggle.is_active) {
        throw new Error(`Template '${templateName}' is disabled by the organization admin`);
      }

      // 4. Verify credit balance
      const creditCost = template.credit_cost;
      if (org.whatsapp_credits < creditCost) {
        throw new Error(`Insufficient credits. Required: ${creditCost}, Available: ${org.whatsapp_credits}`);
      }

      // 5. Get recipient client details
      let phone = "";
      if (clientId) {
        const client = await prisma.clients.findUnique({
          where: { id: clientId },
          select: { phone: true },
        });
        phone = client?.phone || "";
      }

      if (!phone) {
        throw new Error("Client phone number is missing");
      }

      const formattedPhone = formatPhoneNumber(phone);
      const messageBody = formatTemplateBody(template.body, params);

      // Update log with recipient phone and formatted message
      await prisma.whatsapp_logs.update({
        where: { id: logEntry.id },
        data: {
          phone_number: formattedPhone,
          message_body: messageBody,
        },
      });

      // 6. Connect to Twilio and Send Message
      const client = getTwilioClient();
      if (!client) {
        throw new Error("Twilio integration is not configured properly on the server");
      }

      const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886"; // sandbox default
      const recipient = `whatsapp:${formattedPhone}`;

      console.log(`[Worker] Sending Twilio WhatsApp message from ${twilioNumber} to ${recipient}`);

      const response = await client.messages.create({
        from: twilioNumber,
        to: recipient,
        body: messageBody, // sends template text
      });

      console.log(`[Worker] Twilio success, Message SID: ${response.sid}`);

      // 7. Deduct credits and update log status to SUCCESS
      await prisma.$transaction(async (tx) => {
        // Double check balance inside tx
        const currentOrg = await tx.organizations.findUnique({
          where: { id: organizationId },
          select: { whatsapp_credits: true },
        });

        if (currentOrg.whatsapp_credits < creditCost) {
          throw new Error("Insufficient credits inside transaction");
        }

        // Deduct
        await tx.organizations.update({
          where: { id: organizationId },
          data: {
            whatsapp_credits: {
              decrement: creditCost,
            },
          },
        });

        // Update log
        await tx.whatsapp_logs.update({
          where: { id: logEntry.id },
          data: {
            status: "SUCCESS",
            twilio_sid: response.sid,
            credits_deducted: creditCost,
            updated_at: new Date(),
          },
        });
      });

    } catch (err) {
      console.error(`[Worker] Error processing WhatsApp job for log ${logEntry.id}:`, err.message);
      await prisma.whatsapp_logs.update({
        where: { id: logEntry.id },
        data: {
          status: "FAILED",
          error_message: err.message,
          updated_at: new Date(),
        },
      });
    }
  },
  {
    connection: redisConnection,
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
  appointmentId,
  templateName,
  params = [],
}) => {
  try {
    const job = await whatsappQueue.add("sendWhatsapp", {
      organizationId,
      clientId,
      appointmentId,
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
