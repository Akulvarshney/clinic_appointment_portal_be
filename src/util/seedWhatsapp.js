import prisma from "../prisma.js";

const DEFAULT_TEMPLATES = [
  {
    name: "APPOINTMENT_BOOKED",
    twilio_template_id: "HX3d55cfb8d8b039fcc630a3645fd346c9",
    body:
      `Hello {{1}},

    Your appointment for {{2}} has been confirmed.

    Your appointment is scheduled on {{3}} at {{4}}.

    Please arrive at least 10 minutes before your appointment.

    If you need assistance regarding your appointment, please contact us at {{5}}.

    Thank you,
    Team {{6}}.
    We look forward to your visit.`,
    credit_cost: 1.0,
  },
  {
    name: "appointment_rescheduled",
    twilio_template_id: "HX0a2972e10874c5e7436f48313d265f7a",
    body:
      `Hi {{1}}! 👋

    Your appointment with {{2}} has been rescheduled.

    📅 New Date: {{3}}
    🕒 New Time: {{4}}

    If this new schedule doesn't work for you or you need any assistance, please contact us at {{5}}.

    Thank you for your understanding and choosing {{6}}
    We look forward to seeing you!`,
    credit_cost: 1.0,
  },
  {
    name: "appointment_cancelled",
    twilio_template_id: "HXa9acfe34f6363c013b0d1cefa4b774db",
    body:
      `Hi {{1}}! 👋

    Your appointment with {{2}} scheduled for:
    📅 Date: {{3}}
    🕒 Time: {{4}}
    has been cancelled.

    To book a new appointment or if you need any assistance, please contact us at {{5}}.

    Thank you for your understanding and choosing {{6}}.
    We look forward to serving you!`,
    credit_cost: 1.0,
  },
  {
    name: "client_registration_1",
    twilio_template_id: "HXbc24c239830654f6b0466fdea4e00570",
    body:
      `Hello {{1}},

    This is to confirm that your registration has been completed successfully.

    Your profile is now active and ready to be used for future appointments and services.

    Thank you,
    Team {{2}}.

    We are here to assist you whenever you need us.`,
    credit_cost: 1.5,
  },
  {
    name: "feedback_1",
    twilio_template_id: "HX7956f68cf70cb2182db0c2b7af6ce030",
    body:
      `Hello {{1}},

    Thank you for your recent visit.

    We value your feedback and would appreciate hearing about your experience.

    Please share your feedback using the link below:

    {{3}}

    Thank you,
    Team {{2}}.

    Your feedback helps us improve our services.`,
    credit_cost: 0.5,
  },
];

export const seedWhatsappTemplates = async () => {
  try {
    console.log("🌱 Seeding WhatsApp default templates...");

    // Seed global credit value setting if not exists
    const creditValueSetting = await prisma.system_settings.findUnique({
      where: { key: "WHATSAPP_CREDIT_VALUE" },
    });
    if (!creditValueSetting) {
      await prisma.system_settings.create({
        data: {
          key: "WHATSAPP_CREDIT_VALUE",
          value: "1.0", // 1 credit = 1.0 currency unit (e.g. ₹1.00 or $1.00)
        },
      });
      console.log("✅ Seeded system setting: WHATSAPP_CREDIT_VALUE = 1.0");
    }

    // Seed templates
    for (const t of DEFAULT_TEMPLATES) {
      await prisma.whatsapp_templates.upsert({
        where: { name: t.name },
        update: {
          twilio_template_id: t.twilio_template_id,
          body: t.body,
          credit_cost: t.credit_cost,
        },
        create: {
          name: t.name,
          twilio_template_id: t.twilio_template_id,
          body: t.body,
          credit_cost: t.credit_cost,
        },
      });
    }
    console.log(`✅ Seeded ${DEFAULT_TEMPLATES.length} WhatsApp templates.`);

    // Sync templates to all organizations
    await syncWhatsappTemplatesForOrgs();
  } catch (error) {
    console.error("❌ Error seeding WhatsApp templates:", error);
  }
};

export const syncWhatsappTemplatesForOrgs = async () => {
  try {
    console.log("🔄 Synchronizing WhatsApp templates for all organizations...");
    const orgs = await prisma.organizations.findMany({
      where: { is_valid: true },
      select: { id: true },
    });
    const templates = await prisma.whatsapp_templates.findMany({
      where: { is_valid: true },
      select: { id: true },
    });

    if (orgs.length === 0 || templates.length === 0) {
      return;
    }

    let createdCount = 0;
    for (const org of orgs) {
      for (const t of templates) {
        // Find existing toggle mapping
        const existing = await prisma.whatsapp_templates_organizations.findUnique({
          where: {
            template_id_organization_id: {
              template_id: t.id,
              organization_id: org.id,
            },
          },
        });

        if (!existing) {
          await prisma.whatsapp_templates_organizations.create({
            data: {
              template_id: t.id,
              organization_id: org.id,
              is_active: false, // defaulted to false, org admin must toggle it on
            },
          });
          createdCount++;
        }
      }
    }

    console.log(`✅ Synchronized ${createdCount} template toggles across organizations.`);
  } catch (error) {
    console.error("❌ Error synchronizing WhatsApp templates for organizations:", error);
  }
};
