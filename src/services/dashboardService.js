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