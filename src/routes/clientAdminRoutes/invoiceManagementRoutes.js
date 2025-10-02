import { Router } from "express";
import {
  createInvoice,
  createQuotation,
  getInvoices,
  saveAsInvoices,
} from "../../controller/invoicesController.js";
import { checkOrgInfoComplete } from "../../middleware/invoiceMiddleware.js";
// import { generateInvoicePdf } from "../../controller/invoicePdfGeneratorController.js";

const router = Router();

router.post("/create", checkOrgInfoComplete, createInvoice); // create invoice
router.post("/quotation/create", checkOrgInfoComplete, createQuotation); // create Quotation
router.get("/getBills", getInvoices);
router.post("/saveAsInvoices", saveAsInvoices);
// router.get("/invoice/:billid", generateInvoicePdf);

export default router;
