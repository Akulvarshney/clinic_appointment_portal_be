import { Router } from "express";
import { getFormController, saveFormController } from "../../controller/surveyAdminController.js";

const router = Router();

router.get("/getForm", getFormController);
router.post("/saveForm", saveFormController);

export default router;
