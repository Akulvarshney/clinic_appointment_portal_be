import Prisma from "../prisma.js";

export const getKPIDataService = async (orgId) => {
    const totalClients = await Prisma.clients.count({
      where: { organization_id: orgId },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayAppointments = await Prisma.appointments.count({
      where: {
        organization_id: orgId,
        date_time: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const totalAppointments = await Prisma.appointments.count({
      where: { organization_id: orgId },
    });

    const kpiData = [
      { title: "Total Clients", amount: totalClients },
      { title: "Today Appointments", amount: todayAppointments },
      { title: "Total Appointments", amount: totalAppointments },
    ];

  return kpiData;
};

export const getBarChartDataService = async (orgId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 5);
  endDate.setHours(23, 59, 59, 999);

  // Fetch appointments in next 5 days
  const appointments = await Prisma.appointments.findMany({
    where: {
      organization_id: orgId,
      date_time: {
        gte: today,
        lte: endDate,
      },
    },
    select: {
      date_time: true,
    },
  });

  // Initialize counts for 5 days
  const counts = {};
  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue...
    counts[dayName] = 0;
  }

  // Count appointments per day
  appointments.forEach((appt) => {
    const d = new Date(appt.date_time);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
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


export const getPieChartDataService = async(orgId) =>{

const pieRows = await Prisma.categories.findMany({
  where: {
    organization_id: orgId,       // UUID string
    status: 'ENABLED',
    is_valid:true,
  },
  select: {
    category_name: true,
    categories_color:true,
    _count: { select: { clients: true } }, 
  },
  orderBy: { category_name: 'asc' },
});
console.log("pieRows>>> " , pieRows)

// shape for Recharts
const pieData = pieRows.map(r => ({
  name: r.category_name,
  value: r._count.clients, 
  color:r.categories_color
}));

    console.log(pieData);
    return pieData;
}