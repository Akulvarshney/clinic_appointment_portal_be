import { Router } from "express";
import {
  createInvoice,
  createQuotation,
  getInvoices,
  saveAsInvoices,
} from "../../controller/invoicesController.js";

const router = Router();

router.post("/create", createInvoice);
router.post("/quotation/create", createQuotation);
router.get("/getBills", getInvoices);
router.post("/saveAsInvoices", saveAsInvoices);

export default router;
