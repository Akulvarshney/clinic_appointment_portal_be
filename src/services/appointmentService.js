import Prisma from "../prisma.js";
import { DateTime } from "luxon";
import { queueWhatsappNotification } from "./whatsappQueueService.js";

const APP_TIMEZONE = "Asia/Kolkata";

function addCalendarDays(dateTime, days) {
  const calendarDate = DateTime.fromJSDate(new Date(dateTime), { zone: APP_TIMEZONE })
    .startOf("day")
    .plus({ days });

  // UTC noon keeps PostgreSQL DATE columns on the intended calendar day.
  return new Date(
    Date.UTC(calendarDate.year, calendarDate.month - 1, calendarDate.day, 12, 0, 0)
  );
}

function formatCalendarDate(dateTime) {
  return DateTime.fromJSDate(new Date(dateTime), { zone: APP_TIMEZONE }).toFormat(
    "dd/MM/yyyy"
  );
}

function formatClientName(client) {
  if (!client) return "";
  return [client.first_name, client.last_name].filter(Boolean).join(" ");
}

function getClientPortalId(client, organizationId) {
  const orgCategory = client?.client_organization_category?.find(
    (row) => row.organization_id === organizationId
  );
  return orgCategory?.portal_id || client?.portalid || "";
}

async function generateAppointmentPortal_id() {
  return await Prisma.$transaction(async (tx) => {
    const latest = await tx.appointments.findFirst({
      where: {
        portal_id: {
          startsWith: "APPT_",
        },
      },
      orderBy: {
        portal_id: "desc",
      },
      select: {
        portal_id: true,
      },
    });

    let nextNumber = 1;
    if (latest?.portal_id) {
      const numPart = parseInt(latest.portal_id.split("_")[1]);
      if (!isNaN(numPart)) {
        nextNumber = numPart + 1;
      }
    }

    const newPortalId = `APPT_${String(nextNumber).padStart(5, "0")}`;
    return newPortalId;
  });
}

export const bookAppointmentService = async (
  title,
  clientId,
  resourceId,
  date,
  start,
  end,
  orgId,
  remarks,
  doctorId,
  serviceId,
  employeeId,
  createdByUserId
) => {
  const portal_id = await generateAppointmentPortal_id();
  console.log("portal_id>> ", portal_id);

  const appt = await Prisma.appointments.create({
    data: {
      portal_id,
      organization_id: orgId,
      client_id: clientId,
      created_by_user_id: createdByUserId || null,
      resource_id: resourceId,
      date_time: date,
      start_time: start,
      end_time: end,
      remarks: remarks,
      service_id: serviceId,
      doctor_id: doctorId ? doctorId : null,
      employee_id: employeeId ? employeeId : null,
    },
  });
  console.log("Booked APPOINTMETNT>>>> ", appt);

  // Queue WhatsApp Notification
  try {
    const details = await Prisma.appointments.findUnique({
      where: { id: appt.id },
      include: {
        clients: true,
        services: true,
        doctors: true,
        employees: true,
        organizations: {
          include: { organization_billing_details: true },
        },
      },
    });

    if (details) {
      const clientName = details.clients ? `${details.clients.first_name || ""} ${details.clients.last_name || ""}`.trim() : "Client";
      const staffName = details.doctors
        ? `Dr. ${details.doctors.first_name || ""}`.trim()
        : details.employees
          ? `${details.employees.first_name || ""}`.trim()
          : "Staff";

      const apptDate = formatCalendarDate(details.date_time);
      const apptTime = DateTime.fromJSDate(new Date(details.start_time), { zone: APP_TIMEZONE }).toFormat("hh:mm a");

      const orgName = details.organizations?.name || "Our Clinic";
      const orgContact = details.organizations?.billing_phone || "our contact number";
      const orgBrandName =
        details.organizations?.organization_billing_details
          ?.billing_brand_name || orgName;
      const serviceName = details.services?.name || "Service";

      await queueWhatsappNotification({
        organizationId: orgId,
        clientId,
        templateName: "APPOINTMENT_BOOKED",
        params: [clientName, serviceName, apptDate, apptTime,  orgContact , orgBrandName]
      });
    }
  } catch (err) {
    console.error("Failed to queue WhatsApp booking notification:", err);
  }

  return { message: "Appointment Successfully Scheduled ", status: 200 };
};

export const getActiveAppointmentService = async (orgId, date) => {
  const startOfDay = new Date(date); // already ISO from FE
  const endOfDay = new Date(new Date(date).setUTCHours(23, 59, 59, 999));
  const appts = await Prisma.appointments.findMany({
    where: {
      organization_id: orgId,
      date_time: {
        gte: startOfDay,
        lte: endOfDay,
      },
      is_valid: true,
      status: {
        not: "CANCELLED",
      },
    },
    include: {
      clients: {
        select: {
          id: true,
          first_name: true,
          email: true,
          phone: true,
          client_organization_category: {
            where: {
              organization_id: orgId, // important, since client can exist in multiple orgs
            },
            select: {
              portal_id: true,
            },
          },
        },
      },
      services: {
        select: {
          id: true,
          name: true,
        },
      },
      doctors: {
        select: {
          id: true,
          first_name: true,
        },
      },
      employees: {
        select: {
          id: true,
          first_name: true,
        },
      },
    },
  });
  return appts;
};

export const cancelAppointmentsService = async (id, cancelRemarks) => {
  const updatedAppt = await Prisma.appointments.update({
    data: {
      status: "CANCELLED",
      cancel_remarks: cancelRemarks,
      cancel_date_time: new Date(),
    },
    where: {
      id,
    },
    include: {
      clients: true,
      services: true,
      doctors: true,
      employees: true,
      organizations: {
        include: { organization_billing_details: true },
      },
    },
  });

  try {
    const clientName = updatedAppt.clients ? `${updatedAppt.clients.first_name || ""} ${updatedAppt.clients.last_name || ""}`.trim() : "Client";
    const staffName = updatedAppt.doctors
      ? `Dr. ${updatedAppt.doctors.first_name || ""}`.trim()
      : updatedAppt.employees
        ? `${updatedAppt.employees.first_name || ""}`.trim()
        : "Staff";

    const apptDate = formatCalendarDate(updatedAppt.start_time);
    const apptTime = DateTime.fromJSDate(new Date(updatedAppt.start_time), { zone: APP_TIMEZONE }).toFormat("hh:mm a");

    const orgName = updatedAppt.organizations?.name || "Our Clinic";
    const orgContact = updatedAppt.organizations?.billing_phone || "our contact number";
    const orgBrandName =
      updatedAppt.organizations?.organization_billing_details
        ?.billing_brand_name || orgName;
        const serviceName = updatedAppt.services?.name || "Service";


    await queueWhatsappNotification({
      organizationId: updatedAppt.organization_id,
      clientId: updatedAppt.client_id,
      templateName: "appointment_cancelled",
      params: [clientName, serviceName, apptDate, apptTime, orgBrandName,orgContact],
    });
  } catch (err) {
    console.error("Failed to queue WhatsApp cancellation notification:", err);
  }
};

export const changeAppointmentStatusService = async (id, status) => {
  const appointment = await Prisma.appointments.findFirst({
    where: { id },
    include: {
      clients: {
        select: {
          first_name: true,
          last_name: true,
          portalid: true,
          client_organization_category: {
            select: {
              organization_id: true,
              portal_id: true,
            },
          },
        },
      },
      services: {
        select: {
          id: true,
          name: true,
          session_interval: true,
          ptc_required: true,
        },
      },
      organizations: true,
    },
  });

  if (!appointment) {
    throw new Error("Appointment not found this ID");
  }

  const updatedAppointment = await Prisma.appointments.update({
    data: {
      status,
    },
    where: {
      id,
    },
    include: {
      clients: true,
      services: true,
      doctors: true,
      employees: true,
      organizations: {
        include: { organization_billing_details: true },
      },
    },
  });

  const shouldCreateReminder =
    status === "VISITED" && appointment.status !== "VISITED";

  const clientPortalId = getClientPortalId(
    appointment.clients,
    appointment.organization_id
  );

  if (shouldCreateReminder) {
    try {
      const existingFeedback = await Prisma.feedback.findFirst({
        where: { appointment_id: appointment.id }
      });

      if (!existingFeedback) {
        const feedbackRecord = await Prisma.feedback.create({
          data: {
            organization_id: appointment.organization_id,
            appointment_id: appointment.id,
            status: "Pending"
          }
        });

        const baseUrl = process.env.FRONTEND_URL || "https://theglorywellnic.web.app";
        const feedbackUrl = `${baseUrl.replace(/\/$/, '')}/feedback/${feedbackRecord.id}`;
        const clientName = formatClientName(appointment.clients);
        const orgName = appointment.organizations?.name || "Our Clinic";
        const orgBrandName =
        updatedAppointment.organizations?.organization_billing_details
            ?.billing_brand_name || orgName;
        const serviceName = appointment.services?.name || "Service";

        await queueWhatsappNotification({
          organizationId: appointment.organization_id,
          clientId: appointment.client_id,
          templateName: "feedback_1",
          params: [clientName, orgBrandName, feedbackUrl],
        });
      }
    } catch (err) {
      console.error("Failed to create feedback or queue WhatsApp notification:", err);
    }
    const intervalDays = parseInt(appointment.services?.session_interval, 10);
    if (
      appointment.client_id &&
      appointment.organization_id &&
      Number.isFinite(intervalDays) &&
      intervalDays > 0
    ) {
      await Prisma.reminder.create({
        data: {
          organization_id: appointment.organization_id,
          client_id: appointment.client_id,
          reminderdate: addCalendarDays(new Date(), intervalDays),
          remindercomments: `FOLLOW UP for ${appointment.services.name} for Client ${appointment.clients?.first_name} (${clientPortalId}) for Appt ID ${appointment.portal_id} on Appt Date ${formatCalendarDate(
            appointment.date_time
          )}`
          ,
        },
      });
    }

    if (
      appointment.client_id &&
      appointment.organization_id &&
      appointment.services?.ptc_required && appointment.status !== "VISITED"
    ) {
      const clientName = formatClientName(appointment.clients);
      await Prisma.reminder.create({
        data: {
          organization_id: appointment.organization_id,
          client_id: appointment.client_id,
          reminderdate: addCalendarDays(new Date(), 1),
          remindercomments: `PTC for Client ${clientName} (${clientPortalId}) for Appt ID ${appointment.portal_id} on Appt Date ${formatCalendarDate(
            appointment.date_time
          )}`,
        },
      });
    }
  }

  const shouldCreateNoShowReminder =
    status === "NO_SHOW" && appointment.status !== "NO_SHOW";

  if (shouldCreateNoShowReminder) {
    const intervalDays = parseInt(appointment.services?.session_interval, 10);
    if (
      appointment.client_id &&
      appointment.organization_id &&
      Number.isFinite(intervalDays) &&
      intervalDays > 0
    ) {
      const clientName = formatClientName(appointment.clients);
      const serviceName = appointment.services?.name || "";
      await Prisma.reminder.create({
        data: {
          organization_id: appointment.organization_id,
          client_id: appointment.client_id,
          reminderdate: addCalendarDays(new Date(), 1),
          remindercomments: `No SHOW for Client ${clientName}( ${clientPortalId} ). Service : ${serviceName} for Appt ID ${appointment.portal_id} on Appt Date ${formatCalendarDate(
            appointment.date_time
          )}`,
        },
      });
    }
  }

  return updatedAppointment;
};

export const reScheduleAppointmentService = async (
  end,
  start,
  id,
  resourceId
) => {
  console.log("reScheduleAppointmentService >>> ", end, start, id, resourceId);
  const appt = await Prisma.appointments.findFirst({
    where: {
      id,
    },
  });
  if (!appt) {
    throw new Error("Appointment Not found: Error while updating Appoitnment");
  }
  const response = await Prisma.appointments.update({
    where: {
      id,
    },
    data: {
      resource_id: resourceId,
      start_time: start,
      end_time: end,
    },
    include: {
      clients: true,
      services: true,
      doctors: true,
      employees: true,
      organizations: true,
    },
  });

  try {
    const clientName = response.clients ? `${response.clients.first_name || ""} ${response.clients.last_name || ""}`.trim() : "Client";
    const staffName = response.doctors
      ? `Dr. ${response.doctors.first_name || ""}`.trim()
      : response.employees
        ? `${response.employees.first_name || ""}`.trim()
        : "Staff";

    const apptDate = formatCalendarDate(response.start_time);
    const newTime = DateTime.fromJSDate(new Date(response.start_time), { zone: APP_TIMEZONE }).toFormat("hh:mm a");

    const orgName = response.organizations?.name || "Our Clinic";
    const orgContact = response.organizations?.billing_phone || "our contact number";

    await queueWhatsappNotification({
      organizationId: response.organization_id,
      clientId: response.client_id,
      templateName: "appointment_rescheduled",
      params: [clientName, staffName, apptDate, newTime, orgContact, orgName],
    });
  } catch (err) {
    console.error("Failed to queue WhatsApp reschedule notification:", err);
  }
};

export const updateAppointmentService = async (
  id,
  doctorId,
  employeeId,
  serviceId,
  notes
) => {
  const appt = await Prisma.appointments.findFirst({
    where: {
      id,
    },
  });
  if (!appt) {
    throw new Error("Appointment not found this ID");
  }
  await Prisma.appointments.update({
    where: {
      id,
    },
    data: {
      service_id: serviceId,
      employee_id: employeeId,
      doctor_id: doctorId,
      remarks: notes,
    },
  });
};

export const addClinicalRemarksService = async (
  id,
  clinicalRemarks,
  clinicalNotesAddedBy
) => {
  const appt = await Prisma.appointments.findFirst({
    where: {
      id,
    },
  });
  if (!appt) {
    throw new Error("Appointment not found this ID");
  }

  return await Prisma.appointments.update({
    where: {
      id,
    },
    data: {
      clinical_notes: clinicalRemarks,
      clinical_notes_added_by: clinicalNotesAddedBy || null,
    },
  });
};
