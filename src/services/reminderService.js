import { DateTime } from "luxon";
import Prisma from "../prisma.js";

export const saveReminderService = async (
  orgId,
  clientId,
  reminderDate,
  comments
) => {
  const reminder = await Prisma.reminder.create({
    data: {
      organization_id: orgId,
      client_id: clientId,
      reminderdate: new Date(reminderDate).toISOString(),
      remindercomments: comments,
    },
  });
  if (!reminder) {
    throw new Error("Error creating Reminder");
  }

  return reminder;
};
export const updateReminderService = async (id, remarks) => {
  await Prisma.reminder.update({
    where: {
      uuid: id,
    },
    data: {
      status: "checked",
      remindercompletedremarks: remarks,
    },
  });
};

//ReminderService
export const getReminderService = async (orgId, date) => {
  const response = await Prisma.reminder.findMany({
    where: {
      organization_id: orgId,
      reminderdate: new Date(date),
    },
    include: {
      clients: {
        select: {
          first_name: true,
        },
      },
    },
  });

  if (!response) {
    throw new Error("Error getting Reminders");
  }

  return response;
};

export const getRemindersDownloadData = async ({ orgId, fromDate, toDate }) => {
  const timezone = "Asia/Kolkata";
  const rangeStart = DateTime.fromISO(fromDate, { zone: timezone }).startOf("day");
  const rangeEnd = DateTime.fromISO(toDate, { zone: timezone }).endOf("day");

  if (!rangeStart.isValid || !rangeEnd.isValid) {
    const error = new Error("Invalid fromDate or toDate");
    error.statusCode = 400;
    throw error;
  }

  if (rangeStart > rangeEnd) {
    const error = new Error("fromDate must be before or equal to toDate");
    error.statusCode = 400;
    throw error;
  }

  const reminders = await Prisma.reminder.findMany({
    where: {
      organization_id: orgId,
      is_valid: true,
      reminderdate: {
        gte: rangeStart.toJSDate(),
        lte: rangeEnd.toJSDate(),
      },
    },
    include: {
      clients: {
        select: {
          first_name: true,
          last_name: true,
          phone: true,
          portalid: true,
          client_organization_category: {
            where: { organization_id: orgId },
            select: { portal_id: true },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ reminderdate: "asc" }, { createdat_date: "asc" }],
  });

  const formatDate = (value) =>
    value
      ? DateTime.fromJSDate(new Date(value), { zone: timezone }).toFormat(
          "dd/MM/yyyy"
        )
      : "";

  const rows = reminders.map((reminder, index) => {
    const client = reminder.clients;
    const clientName = [client?.first_name, client?.last_name]
      .filter(Boolean)
      .join(" ");
    const portalId =
      client?.client_organization_category?.[0]?.portal_id ||
      client?.portalid ||
      "";

    return {
      serial_number: index + 1,
      client_name: clientName,
      portal_id: portalId,
      phone: client?.phone || "",
      reminder_date: formatDate(reminder.reminderdate),
      status: reminder.status || "",
      comments: reminder.remindercomments || "",
      completed_remarks: reminder.remindercompletedremarks || "",
      created_date: formatDate(reminder.createdat_date),
    };
  });

  return {
    reminders,
    totalRecords: rows.length,
    rows,
  };
};
