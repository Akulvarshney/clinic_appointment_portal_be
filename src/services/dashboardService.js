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



export const getPieChartDataService = async(orgId) =>{
    //console.log("orgId 123" ,orgId)
    // const result = await Prisma.$queryRaw`
    //     SELECT c.category_name as category, COUNT(cl.id) as count
    //     FROM categories c
    //     LEFT JOIN clients cl ON c.id = cl.category_id
    //     WHERE c.status = 'ENABLED'
    //     AND c.organization_id = ${orgId}
    //     GROUP BY c.category_name
    //     ORDER BY c.category_name;
    //     `;


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