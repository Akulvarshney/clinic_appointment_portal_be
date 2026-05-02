import { sendResponse } from "../util/response.js";
import {
  addBatchStock,
  applyStockChange,
  createInventoryItem,
  getInventoryItemById,
  listBatchesForItem,
  listInventoryItems,
  listInventoryTransactions,
  getInventoryItemFullDetails,
  softDeleteInventoryItem,
  updateInventoryBatch,
  updateInventoryItem,
} from "../services/inventoryManagementService.js";

export const createInventoryItemController = async (req, res) => {
  try {
    const {
      orgId,
      name,
      sku,
      description,
      unit,
      inventory_type,
      initialQuantity,
      reorderLevel,
      batchNumber,
      expiryDate,
    } = req.body;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID (orgId) is required" });
    }

    const data = await createInventoryItem({
      orgId,
      name,
      sku,
      description,
      unit,
      inventory_type,
      initialQuantity,
      reorderLevel,
      batchNumber,
      expiryDate,
    });

    return sendResponse(
      res,
      {
        message: "Inventory item created successfully",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("createInventoryItemController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getBatchesForItemController = async (req, res) => {
  try {
    const { orgId, itemId } = req.query;

    if (!orgId || !itemId) {
      return res.status(400).json({ message: "orgId and itemId are required" });
    }

    const data = await listBatchesForItem({ orgId, itemId });

    return sendResponse(
      res,
      {
        message: "Batches fetched successfully",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("getBatchesForItemController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const addBatchStockController = async (req, res) => {
  try {
    const {
      orgId,
      itemId,
      batchNumber,
      quantity,
      expiryDate,
      costPrice,
      sellingPrice,
      mrp,
      remarks,
    } = req.body;

    if (!orgId || !itemId) {
      return res.status(400).json({ message: "orgId and itemId are required" });
    }

    const data = await addBatchStock({
      orgId,
      itemId,
      batchNumber,
      quantity,
      expiryDate,
      costPrice,
      sellingPrice,
      mrp,
      remarks,
    });

    return sendResponse(
      res,
      {
        message: "New batch created with stock",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("addBatchStockController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getInventoryItemsController = async (req, res) => {
  try {
    const { orgId, page = 1, limit = 10, search = "", billingData } = req.query;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID (orgId) is required" });
    }

    const result = await listInventoryItems({
      orgId,
      page: Number(page),
      limit: Number(limit),
      search,
      billingData,
    });

    return sendResponse(
      res,
      {
        message: "Inventory items fetched successfully",
        data: result,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("getInventoryItemsController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getInventoryItemByIdController = async (req, res) => {
  try {
    const { orgId, itemId } = req.query;

    if (!orgId || !itemId) {
      return res.status(400).json({ message: "orgId and itemId are required" });
    }

    const data = await getInventoryItemById({ orgId, itemId });
    if (!data) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    return sendResponse(
      res,
      {
        message: "Inventory item fetched successfully",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("getInventoryItemByIdController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const updateInventoryBatchController = async (req, res) => {
  try {
    const { orgId, batchId, costPrice, sellingPrice, mrp, expiryDate } =
      req.body;

    if (!orgId || !batchId) {
      return res
        .status(400)
        .json({ message: "orgId and batchId are required" });
    }

    const data = await updateInventoryBatch({
      orgId,
      batchId,
      costPrice,
      sellingPrice,
      mrp,
      expiryDate,
    });

    return sendResponse(
      res,
      {
        message: "Batch updated successfully",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("updateInventoryBatchController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const updateInventoryItemController = async (req, res) => {
  try {
    const { orgId, itemId, name, sku, description, unit, reorderLevel } =
      req.body;

    if (!orgId || !itemId) {
      return res.status(400).json({ message: "orgId and itemId are required" });
    }

    const data = await updateInventoryItem({
      orgId,
      itemId,
      name,
      sku,
      description,
      unit,
      reorderLevel,
    });

    return sendResponse(
      res,
      {
        message: "Inventory item updated successfully",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("updateInventoryItemController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const deleteInventoryItemController = async (req, res) => {
  try {
    const { orgId, itemId } = req.body;

    if (!orgId || !itemId) {
      return res.status(400).json({ message: "orgId and itemId are required" });
    }

    await softDeleteInventoryItem({ orgId, itemId });

    return sendResponse(
      res,
      {
        message: "Inventory item removed successfully",
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("deleteInventoryItemController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const adjustStockController = async (req, res) => {
  try {
    const {
      orgId,
      inventoryBatchId,
      transactionType,
      quantity,
      adjustmentToQuantity,
      remarks,
    } = req.body;

    if (!orgId || !inventoryBatchId || !transactionType) {
      return res.status(400).json({
        message:
          "orgId, inventoryBatchId, and transactionType are required (STOCK_IN | STOCK_OUT | ADJUSTMENT)",
      });
    }

    const data = await applyStockChange({
      orgId,
      inventoryBatchId,
      transactionType,
      quantity,
      adjustmentToQuantity,
      remarks,
    });

    return sendResponse(
      res,
      {
        message: "Stock updated successfully",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("adjustStockController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

export const getInventoryTransactionsController = async (req, res) => {
  try {
    const { orgId, itemId, batchId, page = 1, limit = 20 } = req.query;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID (orgId) is required" });
    }

    const result = await listInventoryTransactions({
      orgId,
      itemId,
      batchId,
      page: Number(page),
      limit: Number(limit),
    });

    return sendResponse(
      res,
      {
        message: "Transactions fetched successfully",
        data: result,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("getInventoryTransactionsController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};

/** SKU audit: batches, transactions (paginated), bills referencing this item */
export const getInventoryItemFullDetailsController = async (req, res) => {
  try {
    const {
      orgId,
      itemId,
      transactionsPage = 1,
      transactionsLimit = 200,
      includeInactiveItem,
    } = req.query;

    if (!orgId || !itemId) {
      return res.status(400).json({
        message: "orgId and itemId are required",
      });
    }

    const data = await getInventoryItemFullDetails({
      orgId,
      itemId,
      transactionsPage: Number(transactionsPage),
      transactionsLimit: Number(transactionsLimit),
      includeInactiveItem:
        includeInactiveItem === "true" || includeInactiveItem === "1",
    });

    return sendResponse(
      res,
      {
        message: "Inventory item full details fetched successfully",
        data,
        status: 200,
      },
      200,
    );
  } catch (error) {
    console.error("getInventoryItemFullDetailsController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};
