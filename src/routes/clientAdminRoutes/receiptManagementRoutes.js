import { Router } from "express";

import { saveReceipt, getReceipt } from "../../controller/receiptController.js";

const router = Router();

router.post("/createReceipt", saveReceipt);
router.get("/getReceiptDetails", getReceipt);

export default router;
