import { Router } from "express";
import {
  createInvoice,
  createQuotation,
  getInvoices,
} from "../../controller/invoicesController.js";

const router = Router();

router.post("/create", createInvoice);
router.post("/quotation/create", createQuotation);
router.get("/getInvoice", getInvoices);

export default router;
