import { DateTime } from "luxon";
import Prisma from "../prisma.js";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export const getKPIDataService = async (
  orgId,
  timezone = "Asia/Kolkata",
  allowedFeatures = new Set()
) => {
  const now = DateTime.now().setZone(timezone || "Asia/Kolkata");
  const todayStart = now.startOf("day").toUTC().toJSDate();
  const todayEnd = now.endOf("day").toUTC().toJSDate();
  const monthStart = now.startOf("month").toUTC().toJSDate();
  const monthEnd = now.endOf("month").toUTC().toJSDate();
  const todayDateStr = now.toFormat("yyyy-LL-dd");

  const salesBetween = async (gte, lte) => {
    const agg = await Prisma.bills.aggregate({
      _sum: { grand_total: true },
      where: {
        organization_id: orgId,
        is_valid: true,
        bill_type: "INVOICE",
        billStatus: { not: "DELETED" },
        created_at: { gte, lte },
      },
    });
    return parseFloat(agg._sum.grand_total || 0);
  };

  // Each KPI is tied to a DASHBOARD feature. Order here = order on the dashboard.
  const kpiDefinitions = [
    {
      feature: "KPI_TOTAL_CLIENTS",
      title: "Total Clients",
      compute: () =>
        Prisma.client_organization_category.count({
          where: { organization_id: orgId },
        }),
    },
    {
      feature: "KPI_TODAY_APPOINTMENTS",
      title: "Today Appointments",
      compute: () =>
        Prisma.appointments.count({
          where: {
            organization_id: orgId,
            date_time: { gte: todayStart, lte: todayEnd },
            is_cancelled: false,
            is_valid: true,
            resources: { status: { not: "DISABLED" } },
          },
        }),
    },
    {
      feature: "KPI_TODAY_REMINDERS",
      title: "Today's Reminders",
      compute: () =>
        Prisma.reminder.count({
          where: {
            organization_id: orgId,
            reminderdate: new Date(todayDateStr),
            is_valid: true,
          },
        }),
    },
    {
      feature: "KPI_NEW_CLIENTS_THIS_MONTH",
      title: "New Clients this month",
      compute: () =>
        Prisma.client_organization_category.count({
          where: {
            organization_id: orgId,
            created_at: { gte: monthStart, lte: monthEnd },
          },
        }),
    },
    {
      feature: "KPI_TOTAL_SALE_TODAY",
      title: "Total Sale Today",
      compute: () => salesBetween(todayStart, todayEnd),
    },
    {
      feature: "KPI_TOTAL_SALE_THIS_MONTH",
      title: "Total Sale this month",
      compute: () => salesBetween(monthStart, monthEnd),
    },
  ];

  // Only query and return KPIs the user is permitted to see.
  const permitted = kpiDefinitions.filter((k) => allowedFeatures.has(k.feature));

  return Promise.all(
    permitted.map(async (k) => ({ title: k.title, amount: await k.compute() }))
  );
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
          client_organization_category: {
            where: {
              clients: {
                // apply your dateFilter on client fields
                ...dateFilter,
              },
            },
          },
        },
      },
    },
    orderBy: { category_name: "asc" },
  });

  const pieData = pieRows.map((r) => ({
    name: r.category_name,
    value: r._count.client_organization_category,
    color: r.categories_color,
  }));

  return pieData;
};
