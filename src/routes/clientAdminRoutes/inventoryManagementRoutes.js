import { Router } from "express";
import {
  addBatchStockController,
  adjustStockController,
  createInventoryItemController,
  deleteInventoryItemController,
  getBatchesForItemController,
  getInventoryItemByIdController,
  getInventoryItemFullDetailsController,
  getInventoryItemsController,
  getInventoryTransactionsController,
  updateInventoryBatchController,
  updateInventoryItemController,
} from "../../controller/inventoryManagementController.js";

const router = Router();

router.post("/createItem", createInventoryItemController);
router.get("/getBatches", getBatchesForItemController);
router.post("/addBatchStock", addBatchStockController);
router.put("/updateBatch", updateInventoryBatchController);
router.get("/getItems", getInventoryItemsController);
router.get("/getItemById", getInventoryItemByIdController);
router.get("/getItemFullDetails", getInventoryItemFullDetailsController);
router.put("/updateItem", updateInventoryItemController);
router.post("/deleteItem", deleteInventoryItemController);
router.post("/adjustStock", adjustStockController);
router.get("/getTransactions", getInventoryTransactionsController);

export default router;
