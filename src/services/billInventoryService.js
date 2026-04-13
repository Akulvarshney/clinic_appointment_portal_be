/**
 * Bills: ordered `line_items` with SERVICE and/or INVENTORY rows.
 * Inventory lines must target a specific batch; stock moves are per batch.
 * Inventory lines are stored without GST (tax columns zero; totals come from rate × qty − line discount).
 * Stock is deducted only for INVOICE bills, from `inventory_batches.quantity_on_hand`.
 */

export function resolveBillLineKind(item) {
  if (item.line_kind === "SERVICE" || item.line_kind === "INVENTORY") {
    return item.line_kind;
  }

  const hasService = Boolean(item.service_id);
  const hasInventory = Boolean(item.inventory_item_id);

  if (hasService && hasInventory) {
    const err = new Error(
      "Each line must set line_kind to SERVICE or INVENTORY when both service_id and inventory_item_id are present"
    );
    err.statusCode = 400;
    throw err;
  }

  if (hasInventory) return "INVENTORY";
  return "SERVICE";
}

function trimBatch(v) {
  if (v === undefined || v === null || v === "") return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > 100 ? s.slice(0, 100) : s;
}

export function assertMixedBillLinesPayload(line_items) {
  if (!Array.isArray(line_items) || line_items.length === 0) {
    const err = new Error("line_items must be a non-empty array");
    err.statusCode = 400;
    throw err;
  }
}

export function mapLineItemToBillRow(billId, item, lineIndex) {
  const kind = resolveBillLineKind(item);

  if (kind === "SERVICE") {
    if (!item.service_id) {
      const err = new Error(
        "service_id is required for service line items (line_kind SERVICE)"
      );
      err.statusCode = 400;
      throw err;
    }
  } else {
    if (!item.inventory_item_id) {
      const err = new Error(
        "inventory_item_id is required for inventory line items (line_kind INVENTORY)"
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const quantity = parseFloat(item.quantity);
  const rate = parseFloat(item.rate);
  const lineDiscount = parseFloat(item.line_discount_share) || 0;

  if (kind === "INVENTORY") {
    const r = Number.isFinite(rate) ? rate : 0;
    const q = Number.isFinite(quantity) ? quantity : 0;
    const gross = r * q;
    const taxable = Math.max(0, gross - lineDiscount);
    const amountRaw = parseFloat(item.amount);
    const amount = Number.isFinite(amountRaw) ? amountRaw : gross;

    return {
      bill_id: billId,
      line_position: lineIndex,
      line_kind: kind,
      service_id: null,
      inventory_item_id: item.inventory_item_id,
      inventory_batch_id: item.inventory_batch_id ?? null,
      inventory_batch_number: trimBatch(item.inventory_batch_number),
      service_name: item.service_name,
      description: item.description,
      quantity,
      rate,
      amount,
      gst_percentage: 0,
      line_discount_share: lineDiscount,
      taxable_amount: taxable,
      cgst_amount: 0,
      sgst_amount: 0,
      igst_amount: 0,
      total_tax_amount: 0,
      final_amount: taxable,
    };
  }

  return {
    bill_id: billId,
    line_position: lineIndex,
    line_kind: kind,
    service_id: item.service_id,
    inventory_item_id: null,
    inventory_batch_id: null,
    inventory_batch_number: null,
    service_name: item.service_name,
    description: item.description,
    quantity,
    rate,
    amount: parseFloat(item.amount),
    gst_percentage: parseFloat(item.gst_percentage) || 0,
    line_discount_share: lineDiscount,
    taxable_amount: parseFloat(item.taxable_amount),
    cgst_amount: parseFloat(item.cgst_amount) || 0,
    sgst_amount: parseFloat(item.sgst_amount) || 0,
    igst_amount: parseFloat(item.igst_amount) || 0,
    total_tax_amount: parseFloat(item.total_tax_amount) || 0,
    final_amount: parseFloat(item.final_amount),
  };
}

/**
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
export async function deductInventoryForInvoiceBill(
  tx,
  { organizationId, billId, invoiceNumber, billType, lineItemsInput }
) {
  if (billType !== "INVOICE") {
    return;
  }

  for (const item of lineItemsInput) {
    const kind = resolveBillLineKind(item);
    if (kind !== "INVENTORY") continue;

    const qty = Number(item.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      const err = new Error("Each inventory line must have a positive quantity");
      err.statusCode = 400;
      throw err;
    }

    const invId = item.inventory_item_id;

    const inv = await tx.inventory_items.findFirst({
      where: {
        id: invId,
        organization_id: organizationId,
        is_valid: true,
      },
    });
    if (!inv) {
      const err = new Error("Inventory item not found or not in this organization");
      err.statusCode = 404;
      throw err;
    }

    let batchRow = null;
    if (item.inventory_batch_id) {
      batchRow = await tx.inventory_batches.findFirst({
        where: {
          id: item.inventory_batch_id,
          organization_id: organizationId,
          inventory_item_id: invId,
          is_valid: true,
        },
      });
    } else {
      const bn = trimBatch(item.inventory_batch_number);
      if (bn) {
        batchRow = await tx.inventory_batches.findFirst({
          where: {
            inventory_item_id: invId,
            organization_id: organizationId,
            batch_number: bn,
            is_valid: true,
          },
        });
      }
    }

    if (!batchRow) {
      const err = new Error(
        "Each inventory invoice line must specify inventory_batch_id (preferred) or a valid inventory_batch_number for that product"
      );
      err.statusCode = 400;
      throw err;
    }

    const before = Number(batchRow.quantity_on_hand);
    if (before < qty) {
      const err = new Error(
        `Insufficient stock in batch "${batchRow.batch_number}" for "${inv.name}". Available: ${before}, required: ${qty}`
      );
      err.statusCode = 400;
      throw err;
    }

    const after = before - qty;

    await tx.inventory_batches.update({
      where: { id: batchRow.id },
      data: { quantity_on_hand: after, updated_at: new Date() },
    });

    await tx.inventory_transactions.create({
      data: {
        organization_id: organizationId,
        inventory_item_id: invId,
        inventory_batch_id: batchRow.id,
        transaction_type: "STOCK_OUT",
        quantity_delta: -qty,
        quantity_before: before,
        quantity_after: after,
        batch_number: batchRow.batch_number,
        remarks: `Invoice ${invoiceNumber}`,
        source_bill_id: billId,
      },
    });
  }
}

export const billLineItemsOrderBy = [
  { line_position: "asc" },
  { created_at: "asc" },
];
