import twilio from "twilio";
import prisma from "../prisma.js";

// Helper to format phone number to E.164 standard (e.g. +91XXXXXXXXXX)
const formatPhoneNumber = (phone) => {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, ""); // remove non-digits
  if (clean.length === 10) {
    return `+91${clean}`; // default to India code if 10 digit
  }
  return `+${clean}`;
};

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

// Helper to format array parameters to Twilio contentVariables object {"1": "val1", "2": "val2"}
const formatContentVariables = (params) => {
  if (!params || params.length === 0) return null;
  const variables = {};
  params.forEach((param, index) => {
    variables[String(index + 1)] = String(param || "");
  });
  console.log("123", JSON.stringify(variables))
  return JSON.stringify(variables);
};

// Helper to replace placeholders like {{1}}, {{2}} with actual parameters for the DB log body
const formatTemplateBody = (body, params = []) => {
  let formatted = body || "";
  params.forEach((val, index) => {
    formatted = formatted.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, "g"), val || "");
  });
  return formatted;
};

/**
 * Common function to send a WhatsApp message using Twilio Content API,
 * deduct credits, and maintain a log in whatsapp_logs.
 * 
 * @param {Object} args
 * @param {string} args.organizationId - The ID of the organization sending the message
 * @param {string} args.twilio_template_id - The Twilio template ID
 * @param {Array}  args.variables - Array of variables to replace placeholders in the template
 * @param {string} args.clientId - Client ID for logging
 * @returns {Promise<void>} 
 */
export const processAndSendWhatsappMessage = async ({
  organizationId,
  twilio_template_id,
  variables = [],
  clientId,
}) => {
  try {
    // 1. Check if organization has WhatsApp enabled
    const org = await prisma.organizations.findUnique({
      where: { id: organizationId },
      select: { whatsapp_enabled: true, whatsapp_credits: true },
    });

    if (!org || !org.whatsapp_enabled) return;


    console.log("123123```", twilio_template_id)

    // 2. Check if template exists
    const template = await prisma.whatsapp_templates.findFirst({
      where: { twilio_template_id, is_valid: true },
    });

    console.log("123123", template.id)

    if (!template) return;

    // 3. Check if template is enabled for the organization
    const templateOrg = await prisma.whatsapp_templates_organizations.findFirst({
      where: {
        template_id: template.id,
        organization_id: organizationId,
        is_active: true,
      },
    });

    console.log("123123", templateOrg)

    if (!templateOrg) return;

    // 4. Fetch Client phone
    if (!clientId) return;

    const client = await prisma.clients.findUnique({
      where: { id: clientId },
      select: { phone: true },
    });

    console.log("123123", client)

    if (!client || !client.phone) return;

    const formattedPhone = formatPhoneNumber(client.phone);
    const messageBody = formatTemplateBody(template.body, variables);
    const creditCost = template.credit_cost || 1.0;

    console.log("123", creditCost)

    // 5. Check Credits
    if (org.whatsapp_credits < creditCost) {
      await prisma.whatsapp_logs.create({
        data: {
          organization_id: organizationId,
          client_id: clientId,
          phone_number: formattedPhone,
          template_id: template.id,
          template_name: template.name || "UNKNOWN",
          message_body: messageBody,
          status: "FAILED",
          error_message: "Insufficient credits",
          credits_deducted: 0,
        },
      });
      return;
    }

    // 6. Setup Twilio and send
    const twilioClient = getTwilioClient();
    if (!twilioClient) {
      await prisma.whatsapp_logs.create({
        data: {
          organization_id: organizationId,
          client_id: clientId,
          phone_number: formattedPhone,
          template_id: template.id,
          template_name: template.name || "UNKNOWN",
          message_body: messageBody,
          status: "FAILED",
          error_message: "Twilio integration is not configured properly on the server",
          credits_deducted: 0,
        },
      });
      return;
    }

    let twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;
    console.log("!23", twilioNumber)
    if (!twilioNumber || !twilioNumber.startsWith("whatsapp:")) {
      twilioNumber = `whatsapp:${twilioNumber || "+14155238886"}`;
    }

    const recipient = `whatsapp:${formattedPhone}`;
    const messagePayload = {
      from: twilioNumber,
      to: recipient,
      contentSid: twilio_template_id,
    };

    console.log("123", messagePayload)

    const contentVariables = formatContentVariables(variables);
    console
    if (contentVariables) {
      messagePayload.contentVariables = contentVariables;
    }

    let response;
    try {
      console.log(`[Sender] Triggering Twilio Content API to ${recipient} with SID ${twilio_template_id}`);
      response = await twilioClient.messages.create(messagePayload);
      console.log(`[Sender] Twilio success, Message SID: ${response.sid}`);
    } catch (twilioErr) {
      console.error(`[Sender] Twilio Error:`, twilioErr.message);
      await prisma.whatsapp_logs.create({
        data: {
          organization_id: organizationId,
          client_id: clientId,
          phone_number: formattedPhone,
          template_id: template.id,
          template_name: template.name || "UNKNOWN",
          message_body: messageBody,
          status: "FAILED",
          error_message: twilioErr.message,
          credits_deducted: 0,
        },
      });
      return;
    }

    // 7. Deduct credits and create log status to SUCCESS inside a transaction
    await prisma.$transaction(async (tx) => {
      const currentOrg = await tx.organizations.findUnique({
        where: { id: organizationId },
        select: { whatsapp_credits: true },
      });

      const balanceBefore = currentOrg.whatsapp_credits;
      const balanceAfter = balanceBefore - creditCost;

      // Deduct
      await tx.organizations.update({
        where: { id: organizationId },
        data: {
          whatsapp_credits: balanceAfter,
        },
      });

      // Update log
      const logEntry = await tx.whatsapp_logs.create({
        data: {
          organization_id: organizationId,
          client_id: clientId,
          phone_number: formattedPhone,
          template_id: template.id,
          template_name: template.name || "UNKNOWN",
          message_body: messageBody,
          status: "SUCCESS",
          twilio_sid: response.sid,
          credits_deducted: creditCost,
        },
      });

      // Log transaction
      await tx.whatsapp_credit_transactions.create({
        data: {
          organization_id: organizationId,
          transaction_type: "MESSAGE_SENT",
          amount: -creditCost,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_id: logEntry.id,
          description: `Message sent to ${formattedPhone}`,
        }
      });
    });

  } catch (err) {
    console.error(`[Sender] Unhandled Error processing WhatsApp message:`, err.message);
    try {
      await prisma.whatsapp_logs.create({
        data: {
          organization_id: organizationId,
          client_id: clientId || null,
          phone_number: "UNKNOWN",
          template_name: "UNKNOWN",
          message_body: "Error occurred before formatting",
          status: "FAILED",
          error_message: err.message,
          credits_deducted: 0,
        },
      });
    } catch (logErr) {
      console.error(`[Sender] Failed to write error log:`, logErr.message);
    }
  }
};
