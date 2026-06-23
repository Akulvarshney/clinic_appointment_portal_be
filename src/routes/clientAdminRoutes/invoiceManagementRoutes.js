import { Router } from "express";
import {
  createInvoice,
  createQuotation,
  deleteBill,
  getBillById,
  getClientBills,
  getInvoices,
  saveAsInvoices,
} from "../../controller/invoicesController.js";
import { checkOrgInfoComplete } from "../../middleware/invoiceMiddleware.js";
// import { generateInvoicePdf } from "../../controller/invoicePdfGeneratorController.js";

const router = Router();

router.post("/create", checkOrgInfoComplete, createInvoice); // create invoice
router.post("/quotation/create", checkOrgInfoComplete, createQuotation); // create Quotation
router.get("/getBills", getInvoices);
router.get("/getClientBills", getClientBills);
router.post("/saveAsInvoices", saveAsInvoices);
router.get("/billDetail/:id", getBillById);
router.put("/deleteBill", deleteBill);
// router.get("/invoice/:billid", generateInvoicePdf);

export default router;
