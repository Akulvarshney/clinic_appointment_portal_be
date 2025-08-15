import { sendResponse } from "../util/response.js";
import {getKPIDataService} from "../services/dashboardService.js"

export const getKPIData = async(req, res)=>{
    const {orgId } = req.query;
    try {
    const response  = await getKPIDataService(orgId);
    sendResponse(res, {message:"Getting Data successfully",response} , 200);
    } catch(err){
        console.log("Error herer.   ", err.message);
        res.status(401).json({ message: "Error: while getting records" });
    }

}