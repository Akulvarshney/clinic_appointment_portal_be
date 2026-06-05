import Prisma from "../prisma.js";

function addDays(date, days) {
  const base = new Date(date);
  const year = base.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();

  // Use UTC noon for DATE columns so timezone conversion does not shift
  // the stored calendar date back by one day.
  return new Date(Date.UTC(year, month, day + days, 12, 0, 0));
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
  await Prisma.appointments.update({
    data: {
      status: "CANCELLED",
      cancel_remarks: cancelRemarks,
      cancel_date_time: new Date(),
    },
    where: {
      id,
    },
  });
};

export const changeAppointmentStatusService = async (id, status) => {
  const appointment = await Prisma.appointments.findFirst({
    where: { id },
    include: {
      services: {
        select: {
          id: true,
          name: true,
          session_interval: true,
        },
      },
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
  });

  const shouldCreateReminder =
    status === "VISITED" && appointment.status !== "VISITED";

  if (!shouldCreateReminder) {
    return updatedAppointment;
  }

  const intervalDays = parseInt(appointment.services?.session_interval, 10);
  if (
    !appointment.client_id ||
    !appointment.organization_id ||
    !Number.isFinite(intervalDays) ||
    intervalDays <= 0
  ) {
    return updatedAppointment;
  }

  await Prisma.reminder.create({
    data: {
      organization_id: appointment.organization_id,
      client_id: appointment.client_id,
      reminderdate: addDays(new Date(), intervalDays),
      remindercomments: appointment.services?.name
        ? `Follow-up for ${appointment.services.name} for Appt ID ${appointment.portal_id} on Appt Date ${new Date(
            appointment.date_time
          ).toLocaleDateString("en-GB")}`
        : `Follow-up with Appt ID ${appointment.portal_id} on Appt Date ${new Date(appointment.date_time).toLocaleDateString(
            "en-GB"
          )}`,
    },
  });

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
  });
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
