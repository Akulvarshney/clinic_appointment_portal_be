
import prisma from "../prisma.js";
import { sendResponse, sendErrorResponse } from "../util/response.js";
// import {
//   new_application_submit,
//   checkStatus,
//   getStatusList,
//   NewApplicationActionService,
//   checkShortNameService,
// } from "../services/newApplicationService.js";
import {bookAppointmentService,getActiveAppointmentService,cancelAppointmentsService,
  changeAppointmentStatusService , reScheduleAppointmentService,
} from "../services/appointmentService.js"

export const bookAppointmentController = async(req , res) =>{
      const {       
      title,
      clientId,
      resourceId,
      date,
      start,
      end,
      orgId,
      remarks,
      doctorId,
      serviceId,
      employeeId
    } = req.body;
    
      try {
        const response = await bookAppointmentService(      
      title,
      clientId,
      resourceId,
      date,
      start,
      end,
      orgId,
      remarks,
      doctorId,
      serviceId,
      employeeId
    );
        res.json(response); 
      } catch (error) {
        console.error("Error in Appointment Scheduling:", error);
        res.status(500).json({ error: "Failed Scheduling Appointment" });
      }
}


export const getActiveAppointmentsController = async(req , res) =>{
    const {orgId,date } = req.query;
    try{
    const response = await getActiveAppointmentService(orgId,date);
    sendResponse(
      res,
      { message: "Getting Appointments Successfully", response, status: 200 },
      200
    );
    } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(401).json({ message: "Error: while getting Appointments" });
  }
}

export const cancelAppointmentController = async(req , res) =>{             
        const {id } = req.query;
         const {Cancel_remarks } = req.body;
    try{
    const response = await cancelAppointmentsService(id,Cancel_remarks);
    sendResponse(
      res,
      { message: "Appointment Cancelled Successfully", response, status: 200 },
      200
    );
    } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(401).json({ message: "Error: while cancelling Appointment" });
  }
}

export const changeAppointmentStatusController = async(req , res) =>{
            const {id, status } = req.query;
         console.log(id ,  status)
    try{
    const response = await changeAppointmentStatusService(id,status);
    sendResponse(
      res,
      { message: "Appointment Status Updated Successfully", response, status: 200 },
      200
    );
    } catch (error) {
    console.log("Error herer.   ", error.message);
    res.status(401).json({ message: "Error: while updating status" });
  }
}




export const reScheduleAppointmentController = async(req,res)=>{
  const {end,start, id,resourceId } = req.body;
  try{
  const response = await reScheduleAppointmentService(end,start, id,resourceId );
  sendResponse(
      res,
      { message: "Appointment Rescheduled Successfully", status: 200 },
      200
    );
}
catch(error){
  console.log("Error here.   ", error.message);
    res.status(401).json({ message: "Error: while rescheduling Appointment" });

  }
}