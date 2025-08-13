
import prisma from "../prisma.js";
import { sendResponse, sendErrorResponse } from "../util/response.js";
// import {
//   new_application_submit,
//   checkStatus,
//   getStatusList,
//   NewApplicationActionService,
//   checkShortNameService,
// } from "../services/newApplicationService.js";
import {bookAppointmentService} from "../services/appointmentService.js"

export const bookAppointmentController = async(req , res) =>{
      const {       
      title,
      clientId,
      resourceId,
      date,
      start,
      end,
      orgId,
      remarks
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
      remarks);
        res.json(response); 
      } catch (error) {
        console.error("Error in Appointment Scheduling:", error);
        res.status(500).json({ error: "Failed Scheduling Appointment" });
      }
}


export const getActiveAppointmentsController = async(req , res) =>{
    
}

export const cancelAppointmentController = async(req , res) =>{
    
}

export const changeAppointmentStatusController = async(req , res) =>{
    
}
