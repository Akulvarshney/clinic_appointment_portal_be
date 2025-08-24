import { DateTime } from "luxon";
import Prisma from "../prisma.js";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export const getKPIDataService = async (orgId, timezone = "Asia/Kolkata") => {
  const totalClients = await Prisma.clients.count({
    where: { organization_id: orgId },
  });

  const now = DateTime.now().setZone(timezone);

  const todayStart = now.startOf("day").toUTC().toJSDate();
  const todayEnd = now.endOf("day").toUTC().toJSDate();

  console.log("Timezone:", timezone);
  console.log("Appointments start (UTC):", todayStart.toISOString());
  console.log("Appointments end (UTC):", todayEnd.toISOString());

  const todayAppointments = await Prisma.appointments.count({
    where: {
      organization_id: orgId,
      date_time: {
        gte: todayStart,
        lte: todayEnd,
      },
      is_cancelled: false,
      is_valid: true,
      resources: {
        status: {
          not: "DISABLED",
        },
      },
    },
  });

  const todayDateStr = now.toFormat("yyyy-LL-dd");

  console.log("Reminders date (local):", todayDateStr);

  const todaysReminder = await Prisma.reminder.count({
    where: {
      organization_id: orgId,
      reminderdate: new Date(todayDateStr),
      is_valid: true,
    },
  });

  const kpiData = [
    { title: "Total Clients", amount: totalClients },
    { title: "Today Appointments", amount: todayAppointments },
    { title: "Today's Reminders", amount: todaysReminder },
  ];

  return kpiData;
};

export const getBarChartDataService = async (orgId) => {
  const today = DateTime.now().startOf("day");

  const endDate = today.plus({ days: 6 }).endOf("day");

  const appointments = await Prisma.appointments.findMany({
    where: {
      organization_id: orgId,
      date_time: {
        gte: today.toJSDate(),
        lte: endDate.toJSDate(),
      },
    },
    select: {
      date_time: true,
    },
  });

  const counts = {};
  for (let i = 0; i < 7; i++) {
    const currentDay = today.plus({ days: i });
    const dayName = currentDay.toFormat("ccc");
    counts[dayName] = 0;
  }

  appointments.forEach((appt) => {
    const appointmentDate = DateTime.fromJSDate(appt.date_time);
    const dayName = appointmentDate.toFormat("ccc");
    if (counts[dayName] !== undefined) {
      counts[dayName]++;
    }
  });

  const barData = Object.keys(counts).map((day) => ({
    name: day,
    value: counts[day],
  }));

  return barData;
};

export const getPieChartDataServiceold = async (orgId) => {
  const pieRows = await Prisma.categories.findMany({
    where: {
      organization_id: orgId,
      status: "ENABLED",
      is_valid: true,
    },
    select: {
      category_name: true,
      categories_color: true,
      _count: { select: { clients: true } },
    },
    orderBy: { category_name: "asc" },
  });
  console.log("pieRows>>> ", pieRows);

  const pieData = pieRows.map((r) => ({
    name: r.category_name,
    value: r._count.clients,
    color: r.categories_color,
  }));

  console.log(pieData);
  return pieData;
};

export const getPieChartDataService = async (orgId, month, year) => {
  let dateFilter = {};

  if (month && year) {
    const start = startOfMonth(new Date(year, month - 1));
    const end = endOfMonth(new Date(year, month - 1));
    dateFilter = {
      created_at: {
        gte: start,
        lte: end,
      },
    };
  } else if (year) {
    const start = startOfYear(new Date(year, 0));
    const end = endOfYear(new Date(year, 0));
    dateFilter = {
      created_at: {
        gte: start,
        lte: end,
      },
    };
  }
  console.log(dateFilter);

  const pieRows = await Prisma.categories.findMany({
    where: {
      organization_id: orgId,
      status: "ENABLED",
      is_valid: true,
    },
    select: {
      category_name: true,
      categories_color: true,
      _count: {
        select: {
          clients: {
            where: dateFilter,
          },
        },
      },
    },
    orderBy: { category_name: "asc" },
  });

  const pieData = pieRows.map((r) => ({
    name: r.category_name,
    value: r._count.clients,
    color: r.categories_color,
  }));

  return pieData;
};
