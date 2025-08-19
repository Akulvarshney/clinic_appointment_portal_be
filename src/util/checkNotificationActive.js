import prisma from "../prisma.js";

export const checkNotificationActive = async (orgId, uniqueName)=>{

    const notifications =await  prisma.notifications.findFirst({
        where:{
            is_valid : true,
            unique_notification_name:uniqueName

        }
    });
    if(!notifications){
        return false;
    }
    const valid = await prisma.notifications_organizations.findFirst({
        where :{
            organization_id : orgId,
            notification_id : notifications.id,   
        },
        select:{
            is_active:true
        }
    });
    console.log("is_valid notification" ,valid.is_active)
    return valid.is_active;
}