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
      remarks,
          doctorId,
      serviceId,) =>{
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
            remarks:remarks,
            service_id:serviceId,
           // doctor_id:doctorId
                }
        })
        console.log("Booked APPOINTMETNT>>>> " , appt)


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
      status: {
        not: "CANCELLED"
        }
    },
    include: {
      clients: {
        select: {
          id: true,
          first_name: true,
          email: true,
          phone: true,
        },
      },
      services: {
        select: {
          id: true,
          name: true,
        },
      },
      doctors:{
        select:{
          first_name:true,
        }
      },
      employees:{
        select:{
          first_name:true
        }
      }
    },
  });
  return appts;
}



export const cancelAppointmentsService = async(id, cancelRemarks) =>{
    await Prisma.appointments.update({
        data:{
            status:"CANCELLED",
            cancel_remarks:cancelRemarks,
            cancel_date_time: new Date()
        },
        where:{
            id
        }
    })

}








export const changeAppointmentStatusService = async(id, status) =>{
  await Prisma.appointments.update({
    data:{
      status,
    },
    where:{
      id
    }
  })
  
}





export const reScheduleAppointmentService = async(end,start, id,resourceId ) =>{
  console.log("reScheduleAppointmentService >>> ", end,start, id,resourceId );
  const appt = await Prisma.appointments.findFirst({
    where:{
      id,
    }
  });
  if (!appt){
    throw new Error ("Appointment Not found: Error while updating Appoitnment");
  };
  const response =  await Prisma.appointments.update({
    where:{
      id,
    },
    data:{
      resource_id:resourceId,
      start_time:start,
      end_time:end,
    }
  });
  
}