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
      reminderdate: reminderDate,
      remindercomments: comments,
    },
  });
  if (!reminder) {
    throw new Error("Error creating Reminder");
  }

  return reminder;
};
export const updateReminderService = async (id, status, remarks) => {};

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
