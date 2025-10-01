import { Router } from "express";
import {
  createInvoice,
  createQuotation,
  getInvoices,
  saveAsInvoices,
} from "../../controller/invoicesController.js";
// import { generateInvoicePdf } from "../../controller/invoicePdfGeneratorController.js";

const router = Router();

router.post("/create", createInvoice);
router.post("/quotation/create", createQuotation);
router.get("/getBills", getInvoices);
router.post("/saveAsInvoices", saveAsInvoices);
// router.get("/invoice/:billid", generateInvoicePdf);

export default router;
