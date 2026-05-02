import { inventory_type } from "@prisma/client";
import Prisma from "../prisma.js";

const decimal = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n;
};

const money = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
};

const batchNumber = (v) => {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > 100 ? s.slice(0, 100) : s;
};

function sumBatchQty(batches) {
  return batches.reduce((s, b) => s + Number(b.quantity_on_hand), 0);
}

export const createInventoryItem = async ({
  orgId,
  name,
  sku,
  description,
  inventory_type,
  unit,
  initialQuantity,
  reorderLevel,
  batchNumber: batchNumberField,
  expiryDate,
}) => {
  if (!name || !String(name).trim()) {
    const err = new Error("name is required");
    err.statusCode = 400;
    throw err;
  }
  const qty = decimal(initialQuantity) ?? 0;
  const reorder = reorderLevel != null ? decimal(reorderLevel) : null;

  const bn = batchNumber(batchNumberField);
  if (qty > 0 && bn === undefined) {
    const err = new Error(
      "batchNumber is required when initialQuantity is greater than 0 (stock is tracked per batch)",
    );
    err.statusCode = 400;
    throw err;
  }
  const firstBatchLabel = bn ?? (qty > 0 ? "DEFAULT" : undefined);

  try {
    return await Prisma.$transaction(async (tx) => {
      const item = await tx.inventory_items.create({
        data: {
          organization_id: orgId,
          name: name.trim(),
          sku: sku?.trim() || null,
          inventory_type,
          description: description?.trim() || null,
          unit: (unit || "unit").trim(),
          reorder_level: reorder,
        },
      });

      if (qty > 0 && firstBatchLabel) {
        const batch = await tx.inventory_batches.create({
          data: {
            organization_id: orgId,
            inventory_item_id: item.id,
            batch_number: firstBatchLabel,
            expiry_date: expiryDate ? new Date(expiryDate) : null,
            quantity_on_hand: qty,
          },
        });

        await tx.inventory_transactions.create({
          data: {
            organization_id: orgId,
            inventory_item_id: item.id,
            inventory_batch_id: batch.id,
            transaction_type: "STOCK_IN",
            quantity_delta: qty,
            quantity_before: 0,
            quantity_after: qty,
            batch_number: firstBatchLabel,
            remarks: "Initial stock",
          },
        });
      }

      return tx.inventory_items.findUnique({
        where: { id: item.id },
        include: {
          inventory_batches: {
            where: { is_valid: true },
            orderBy: [{ expiry_date: "asc" }, { batch_number: "asc" }],
          },
        },
      });
    });
  } catch (e) {
    if (e.code === "P2002") {
      const msg = e.meta?.target?.includes("uq_inv_item_batch_number")
        ? "This batch number already exists for this product"
        : "An item with this SKU already exists for the organization";
      const err = new Error(msg);
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
};

export const listBatchesForItem = async ({ orgId, itemId }) => {
  const item = await Prisma.inventory_items.findFirst({
    where: { id: itemId, organization_id: orgId, is_valid: true },
    select: { id: true },
  });
  if (!item) {
    const err = new Error("Inventory item not found");
    err.statusCode = 404;
    throw err;
  }

  return Prisma.inventory_batches.findMany({
    where: {
      inventory_item_id: itemId,
      organization_id: orgId,
      is_valid: true,
    },
    orderBy: [{ expiry_date: "asc" }, { batch_number: "asc" }],
  });
};

export const addBatchStock = async ({
  orgId,
  itemId,
  batchNumber: batchLabel,
  quantity,
  expiryDate,
  costPrice,
  sellingPrice,
  mrp,
  remarks,
}) => {
  const bn = batchNumber(batchLabel);
  if (!bn) {
    const err = new Error("batchNumber is required");
    err.statusCode = 400;
    throw err;
  }
  const qty = decimal(quantity);
  if (qty == null || qty <= 0) {
    const err = new Error("quantity must be a positive number");
    err.statusCode = 400;
    throw err;
  }

  const cost = money(costPrice);
  const sell = money(sellingPrice);
  const mrpVal = money(mrp);
  if (costPrice !== undefined && costPrice !== null && cost === null) {
    const err = new Error("costPrice must be a non-negative number");
    err.statusCode = 400;
    throw err;
  }
  if (sellingPrice !== undefined && sellingPrice !== null && sell === null) {
    const err = new Error("sellingPrice must be a non-negative number");
    err.statusCode = 400;
    throw err;
  }
  if (mrp !== undefined && mrp !== null && mrpVal === null) {
    const err = new Error("mrp must be a non-negative number");
    err.statusCode = 400;
    throw err;
  }

  return await Prisma.$transaction(async (tx) => {
    const item = await tx.inventory_items.findFirst({
      where: { id: itemId, organization_id: orgId, is_valid: true },
    });
    if (!item) {
      const err = new Error("Inventory item not found");
      err.statusCode = 404;
      throw err;
    }

    const existing = await tx.inventory_batches.findFirst({
      where: {
        inventory_item_id: itemId,
        batch_number: bn,
        organization_id: orgId,
      },
    });

    if (existing) {
      const err = new Error(
        "Batch already exists for this product — use adjustStock with inventoryBatchId to add quantity",
      );
      err.statusCode = 409;
      throw err;
    }

    const batch = await tx.inventory_batches.create({
      data: {
        organization_id: orgId,
        inventory_item_id: itemId,
        batch_number: bn,
        expiry_date: expiryDate ? new Date(expiryDate) : null,
        quantity_on_hand: qty,
        ...(cost !== undefined ? { cost_price: cost ?? null } : {}),
        ...(sell !== undefined ? { selling_price: sell ?? null } : {}),
        ...(mrpVal !== undefined ? { mrp: mrpVal ?? null } : {}),
      },
    });

    await tx.inventory_transactions.create({
      data: {
        organization_id: orgId,
        inventory_item_id: itemId,
        inventory_batch_id: batch.id,
        transaction_type: "STOCK_IN",
        quantity_delta: qty,
        quantity_before: 0,
        quantity_after: qty,
        batch_number: bn,
        remarks: remarks?.trim() || "New batch / stock in",
      },
    });

    return batch;
  });
};

export const updateInventoryBatch = async ({
  orgId,
  batchId,
  costPrice,
  sellingPrice,
  mrp,
  expiryDate,
}) => {
  const existing = await Prisma.inventory_batches.findFirst({
    where: { id: batchId, organization_id: orgId, is_valid: true },
  });
  if (!existing) {
    const err = new Error("Batch not found");
    err.statusCode = 404;
    throw err;
  }

  const data = { updated_at: new Date() };

  if (expiryDate !== undefined) {
    data.expiry_date = expiryDate ? new Date(expiryDate) : null;
  }

  if (costPrice !== undefined) {
    if (costPrice === null || costPrice === "") {
      data.cost_price = null;
    } else {
      const c = money(costPrice);
      if (c === null) {
        const err = new Error("costPrice must be a non-negative number");
        err.statusCode = 400;
        throw err;
      }
      data.cost_price = c;
    }
  }

  if (sellingPrice !== undefined) {
    if (sellingPrice === null || sellingPrice === "") {
      data.selling_price = null;
    } else {
      const s = money(sellingPrice);
      if (s === null) {
        const err = new Error("sellingPrice must be a non-negative number");
        err.statusCode = 400;
        throw err;
      }
      data.selling_price = s;
    }
  }

  if (mrp !== undefined) {
    if (mrp === null || mrp === "") {
      data.mrp = null;
    } else {
      const m = money(mrp);
      if (m === null) {
        const err = new Error("mrp must be a non-negative number");
        err.statusCode = 400;
        throw err;
      }
      data.mrp = m;
    }
  }

  return Prisma.inventory_batches.update({
    where: { id: batchId },
    data,
  });
};

export const listInventoryItems = async ({
  orgId,
  page = 1,
  limit = 10,
  search = "",
  billingData,
}) => {
  const skip = (page - 1) * limit;
  const baseWhere = {
    organization_id: orgId,
    is_valid: true,
    ...(billingData === "true"
      ? { inventory_type: inventory_type.RETAIL }
      : {}),
  };

  const whereCondition = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          {
            inventory_batches: {
              some: {
                is_valid: true,
                batch_number: { contains: search, mode: "insensitive" },
              },
            },
          },
        ],
      }
    : baseWhere;

  const [rows, totalCount] = await Promise.all([
    Prisma.inventory_items.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        inventory_batches: {
          where: { is_valid: true },
          select: {
            id: true,
            batch_number: true,
            expiry_date: true,
            quantity_on_hand: true,
            cost_price: true,
            selling_price: true,
            mrp: true,
          },
        },
      },
    }),
    Prisma.inventory_items.count({ where: whereCondition }),
  ]);

  const items = rows.map((row) => ({
    ...row,
    total_quantity_on_hand: sumBatchQty(row.inventory_batches),
  }));

  return {
    items,
    totalRecords: totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
};

export const getInventoryItemById = async ({ orgId, itemId }) => {
  const row = await Prisma.inventory_items.findFirst({
    where: {
      id: itemId,
      organization_id: orgId,
      is_valid: true,
    },
    include: {
      inventory_batches: {
        where: { is_valid: true },
        orderBy: [{ expiry_date: "asc" }, { batch_number: "asc" }],
      },
    },
  });
  if (!row) return null;
  return {
    ...row,
    total_quantity_on_hand: sumBatchQty(row.inventory_batches),
  };
};

export const updateInventoryItem = async ({
  orgId,
  itemId,
  name,
  sku,
  description,
  unit,
  reorderLevel,
}) => {
  const existing = await Prisma.inventory_items.findFirst({
    where: { id: itemId, organization_id: orgId, is_valid: true },
  });
  if (!existing) {
    const err = new Error("Inventory item not found");
    err.statusCode = 404;
    throw err;
  }

  const data = {
    updated_at: new Date(),
  };

  if (name != null) data.name = name.trim();
  if (sku !== undefined) data.sku = sku?.trim() || null;
  if (description !== undefined) data.description = description?.trim() || null;
  if (unit != null) data.unit = unit.trim();
  if (reorderLevel !== undefined) {
    data.reorder_level = reorderLevel != null ? decimal(reorderLevel) : null;
  }

  try {
    return await Prisma.inventory_items.update({
      where: { id: itemId },
      data,
    });
  } catch (e) {
    if (e.code === "P2002") {
      const err = new Error(
        "An item with this SKU already exists for the organization",
      );
      err.statusCode = 409;
      throw err;
    }
    throw e;
  }
};

export const softDeleteInventoryItem = async ({ orgId, itemId }) => {
  const existing = await Prisma.inventory_items.findFirst({
    where: { id: itemId, organization_id: orgId, is_valid: true },
  });
  if (!existing) {
    const err = new Error("Inventory item not found");
    err.statusCode = 404;
    throw err;
  }

  await Prisma.$transaction([
    Prisma.inventory_batches.updateMany({
      where: { inventory_item_id: itemId },
      data: { is_valid: false, updated_at: new Date() },
    }),
    Prisma.inventory_items.update({
      where: { id: itemId },
      data: { is_valid: false, updated_at: new Date() },
    }),
  ]);
  return { ok: true };
};

/**
 * All stock moves are per batch: pass inventoryBatchId (UUID of inventory_batches row).
 */
export const applyStockChange = async ({
  orgId,
  inventoryBatchId,
  transactionType,
  quantity,
  adjustmentToQuantity,
  remarks,
}) => {
  if (!inventoryBatchId) {
    const err = new Error(
      "inventoryBatchId is required — stock is tracked per batch",
    );
    err.statusCode = 400;
    throw err;
  }

  return await Prisma.$transaction(async (tx) => {
    const batch = await tx.inventory_batches.findFirst({
      where: {
        id: inventoryBatchId,
        organization_id: orgId,
        is_valid: true,
      },
      include: { inventory_items: true },
    });

    if (!batch || !batch.inventory_items?.is_valid) {
      const err = new Error("Batch not found or product is inactive");
      err.statusCode = 404;
      throw err;
    }

    const itemId = batch.inventory_item_id;
    const before = Number(batch.quantity_on_hand);
    let delta;

    if (transactionType === "STOCK_IN") {
      const qty = decimal(quantity);
      if (qty == null || qty <= 0) {
        const err = new Error("quantity must be a positive number");
        err.statusCode = 400;
        throw err;
      }
      delta = qty;
    } else if (transactionType === "STOCK_OUT") {
      const qty = decimal(quantity);
      if (qty == null || qty <= 0) {
        const err = new Error("quantity must be a positive number");
        err.statusCode = 400;
        throw err;
      }
      delta = -qty;
    } else if (transactionType === "ADJUSTMENT") {
      const target = decimal(adjustmentToQuantity);
      if (target == null || target < 0) {
        const err = new Error(
          "adjustmentToQuantity must be a non-negative number",
        );
        err.statusCode = 400;
        throw err;
      }
      delta = target - before;
    } else {
      const err = new Error("Invalid transactionType");
      err.statusCode = 400;
      throw err;
    }

    const after = before + delta;
    if (after < 0) {
      const err = new Error("Insufficient stock in this batch");
      err.statusCode = 400;
      throw err;
    }

    if (delta === 0) {
      return batch;
    }

    const updated = await tx.inventory_batches.update({
      where: { id: inventoryBatchId },
      data: {
        quantity_on_hand: after,
        updated_at: new Date(),
      },
    });

    await tx.inventory_transactions.create({
      data: {
        organization_id: orgId,
        inventory_item_id: itemId,
        inventory_batch_id: inventoryBatchId,
        transaction_type: transactionType,
        quantity_delta: delta,
        quantity_before: before,
        quantity_after: after,
        batch_number: batch.batch_number,
        remarks: remarks?.trim() || null,
      },
    });

    return updated;
  });
};

export const listInventoryTransactions = async ({
  orgId,
  itemId,
  batchId,
  page = 1,
  limit = 20,
}) => {
  const skip = (page - 1) * limit;
  const whereCondition = {
    organization_id: orgId,
    ...(itemId ? { inventory_item_id: itemId } : {}),
    ...(batchId ? { inventory_batch_id: batchId } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    Prisma.inventory_transactions.findMany({
      where: whereCondition,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
      include: {
        inventory_items: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
        inventory_batches: {
          select: {
            id: true,
            batch_number: true,
            expiry_date: true,
            cost_price: true,
            selling_price: true,
            mrp: true,
          },
        },
      },
    }),
    Prisma.inventory_transactions.count({ where: whereCondition }),
  ]);

  return {
    transactions: rows,
    totalRecords: totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / limit) || 1,
  };
};

const billSelectForInventoryAudit = {
  id: true,
  invoice_number: true,
  bill_type: true,
  invoice_date: true,
  due_date: true,
  grand_total: true,
  status: true,
  created_at: true,
  updated_at: true,
  clients: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  },
};

/**
 * Full audit trail for one SKU: master row, all batches, paginated transactions,
 * and all bills (invoices/quotations) that include this product on an inventory line.
 */
export const getInventoryItemFullDetails = async ({
  orgId,
  itemId,
  transactionsPage = 1,
  transactionsLimit = 200,
  includeInactiveItem = false,
}) => {
  const itemWhere = {
    id: itemId,
    organization_id: orgId,
    ...(includeInactiveItem ? {} : { is_valid: true }),
  };

  const item = await Prisma.inventory_items.findFirst({
    where: itemWhere,
    include: {
      inventory_batches: {
        orderBy: [{ expiry_date: "asc" }, { batch_number: "asc" }],
      },
    },
  });

  if (!item) {
    const err = new Error("Inventory item not found");
    err.statusCode = 404;
    throw err;
  }

  const txWhere = {
    organization_id: orgId,
    inventory_item_id: itemId,
  };

  const txSkip = (Number(transactionsPage) - 1) * Number(transactionsLimit);
  const txTake = Math.min(Number(transactionsLimit) || 200, 1000);

  const [txTotal, transactions, billLines] = await Promise.all([
    Prisma.inventory_transactions.count({ where: txWhere }),
    Prisma.inventory_transactions.findMany({
      where: txWhere,
      orderBy: { created_at: "desc" },
      skip: txSkip,
      take: txTake,
      include: {
        inventory_batches: {
          select: {
            id: true,
            batch_number: true,
            expiry_date: true,
            quantity_on_hand: true,
          },
        },
        source_bill: {
          select: {
            id: true,
            invoice_number: true,
            bill_type: true,
            invoice_date: true,
            grand_total: true,
            status: true,
          },
        },
      },
    }),
    Prisma.bill_line_items.findMany({
      where: {
        inventory_item_id: itemId,
        bills: {
          organization_id: orgId,
          is_valid: true,
        },
      },
      include: {
        bills: {
          select: billSelectForInventoryAudit,
        },
        inventory_batches: {
          select: {
            id: true,
            batch_number: true,
            expiry_date: true,
          },
        },
      },
      orderBy: [{ created_at: "desc" }],
    }),
  ]);

  const billsById = new Map();
  for (const line of billLines) {
    const bill = line.bills;
    if (!bill) continue;
    if (!billsById.has(bill.id)) {
      billsById.set(bill.id, {
        bill,
        inventory_lines: [],
      });
    }
    const { bills: _b, ...lineRest } = line;
    billsById.get(bill.id).inventory_lines.push(lineRest);
  }

  const bills = Array.from(billsById.values()).sort(
    (a, b) =>
      new Date(b.bill.created_at).getTime() -
      new Date(a.bill.created_at).getTime(),
  );

  return {
    item: {
      ...item,
      total_quantity_on_hand: sumBatchQty(item.inventory_batches),
    },
    batches: item.inventory_batches,
    transactions: {
      rows: transactions,
      totalRecords: txTotal,
      currentPage: Number(transactionsPage),
      pageSize: txTake,
      totalPages: Math.ceil(txTotal / txTake) || 1,
    },
    bills,
    billsCount: bills.length,
  };
};
