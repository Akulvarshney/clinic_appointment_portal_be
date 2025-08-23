import { DateTime } from "luxon";
import Prisma from "../prisma.js";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export const getKPIDataService = async (orgId, timezone = "Asia/Kolkata") => {
  const totalClients = await Prisma.clients.count({
    where: { organization_id: orgId },
  });

  const now = DateTime.now().setZone(timezone);

  const todayStart = now.startOf("day");

  const todayEnd = now.endOf("day");

  const todayStartUTC = todayStart.toUTC().toJSDate();
  const todayEndUTC = todayEnd.toUTC().toJSDate();

  console.log("Timezone:", timezone);
  console.log("Today start (local):", todayStart.toISO());
  console.log("Today end (local):", todayEnd.toISO());
  console.log("Today start (UTC for DB):", todayStartUTC.toISOString());
  console.log("Today end (UTC for DB):", todayEndUTC.toISOString());

  const todayAppointments = await Prisma.appointments.count({
    where: {
      organization_id: orgId,
      date_time: {
        gte: todayStartUTC,
        lte: todayEndUTC,
      },
      is_cancelled: false,
      is_valid: true,
    },
  });

  const todaysReminder = await Prisma.reminder.count({
    where: {
      organization_id: orgId,
      reminderdate: {
        gte: todayStartUTC,
        lte: todayEndUTC,
      },
      is_valid: true,
    },
  });

  const kpiData = [
    { title: "Total Clients", amount: totalClients },
    { title: "Today Appointments", amount: todayAppointments },
    { title: "Today's Reminders", amount: todaysReminder },
    // { title: "Total Appointments", amount: totalAppointments },
  ];

  return kpiData;
};

export const getBarChartDataService = async (orgId) => {
  // Get start of today
  const today = DateTime.now().startOf("day");

  // Get end of 5th day (today + 4 days)
  const endDate = today.plus({ days: 6 }).endOf("day");

  // Fetch appointments in next 5 days
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

  // Initialize counts for 5 days
  const counts = {};
  for (let i = 0; i < 7; i++) {
    const currentDay = today.plus({ days: i });
    const dayName = currentDay.toFormat("ccc"); // Mon, Tue, Wed...
    counts[dayName] = 0;
  }

  // Count appointments per day
  appointments.forEach((appt) => {
    const appointmentDate = DateTime.fromJSDate(appt.date_time);
    const dayName = appointmentDate.toFormat("ccc");
    if (counts[dayName] !== undefined) {
      counts[dayName]++;
    }
  });

  // Convert to array for bar chart
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

  // shape for Recharts
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
    // When month/year are provided
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
