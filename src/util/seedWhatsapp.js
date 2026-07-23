import prisma from "../prisma.js";

const DEFAULT_TEMPLATES = [
  {
    name: "APPOINTMENT_BOOKED",
    twilio_template_id: "HX8883a43058090ae4fd815682cefb7814",
    body:
      `Hi {{1}}! 👋
    Your appointment has been confirmed.
    👨‍⚕️ Doctor: {{2}}
    📅 Date: {{3}}
    🕒 Time: {{4}}
    Please arrive 10 minutes before your scheduled appointment.
    If you have any questions or need to reschedule, please contact us at {{6}}.
    Thank you for choosing {{5}}. 
    We look forward to seeing you!`,
    credit_cost: 1.0,
  },
  {
    name: "APPOINTMENT_CANCELLED",
    twilio_template_id: "appointment_cancelled_v1",
    body: "Hello {{1}}, your appointment for {{2}} on {{3}} has been cancelled. Remarks: {{4}}.",
    credit_cost: 1.0,
  },
  {
    name: "APPOINTMENT_RESCHEDULED",
    twilio_template_id: "appointment_rescheduled_v1",
    body: "Hello {{1}}, your appointment for {{2}} has been rescheduled to {{3}} at {{4}}.",
    credit_cost: 1.0,
  },
  {
    name: "FOLLOW_UP_REMINDER",
    twilio_template_id: "follow_up_reminder_v1",
    body: "Hello {{1}}, this is a follow-up reminder for your visit on {{2}}.",
    credit_cost: 1.5,
  },
  {
    name: "BIRTHDAY_WISHES",
    twilio_template_id: "birthday_wishes_v1",
    body: "Dear {{1}}, we wish you a very Happy Birthday! Have a great day ahead. - GloryWellNic Team",
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
