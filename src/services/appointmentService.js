import Prisma from "../prisma.js";
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




export const bookAppointmentService = async(      
      title,
      clientId,
      resourceId,
      date,
      start,
      end,
      orgId,
      remarks) =>{
        const portal_id  = await generateAppointmentPortal_id();
        console.log("portal_id>> " , portal_id)
         
            const appt = await Prisma.appointments.create({
                data:{
            portal_id,
            organization_id:orgId,
            client_id:clientId,
            resource_id:resourceId,
            date_time:date,
            start_time:start,
            end_time:end,
            remarks:remarks
                }
        
        })


     return { message: "Appointment Successfully Scheduled ", status: 200 };


}



export const getActiveAppointmentService = async (orgId,date)=>{
    const startOfDay = new Date(date); // already ISO from FE
const endOfDay = new Date(new Date(date).setUTCHours(23, 59, 59, 999));
    const appts = await Prisma.appointments.findMany({
    where: {
       organization_id: orgId,
        date_time: {
            gte: startOfDay,
            lte: endOfDay
            },
      is_valid: true,
    },
  });
  return appts;
}