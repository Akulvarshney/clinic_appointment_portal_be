import { DateTime } from "luxon";
import Prisma from "../prisma.js";

const TIMEZONE = "Asia/Kolkata";

const PAYMENT_MODE_LABELS = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
};

const toNumber = (value) => Number(parseFloat(value || 0).toFixed(2));

// SERVICE lines are services; INVENTORY lines are products.
const getServiceProductLabel = (lineItems = []) => {
  const hasService = lineItems.some((li) => li.line_kind === "SERVICE");
  const hasProduct = lineItems.some((li) => li.line_kind === "INVENTORY");
  if (hasService && hasProduct) return "BOTH";
  if (hasProduct) return "PRODUCT";
  if (hasService) return "SERVICE";
  return "";
};

const badRequest = (msg) => {
  const error = new Error(msg);
  error.statusCode = 400;
  return error;
};

/**
 * Builds rows for the invoice report (invoices only — no quotations/receipts).
 * Filters on invoice_date between fromDate and toDate (inclusive, YYYY-MM-DD).
 */
export const getInvoiceReportData = async ({ orgId, fromDate, toDate }) => {
  const from = DateTime.fromISO(fromDate, { zone: "utc" });
  const to = DateTime.fromISO(toDate, { zone: "utc" });

  if (!from.isValid || !to.isValid) {
    throw badRequest("Invalid fromDate or toDate");
  }
  if (from > to) {
    throw badRequest("fromDate must be before or equal to toDate");
  }

  // invoice_date is a DATE column, so compare against UTC midnight of each day.
  const bills = await Prisma.bills.findMany({
    where: {
      organization_id: orgId,
      is_valid: true,
      bill_type: "INVOICE",
      billStatus: { not: "DELETED" },
      invoice_date: {
        gte: from.startOf("day").toJSDate(),
        lte: to.startOf("day").toJSDate(),
      },
    },
    select: {
      invoice_number: true,
      invoice_date: true,
      taxable_after_discount: true,
      total_tax: true,
      grand_total: true,
      payment_mode: true,
      bill_line_items: {
        select: { line_kind: true },
      },
    },
    orderBy: [{ invoice_date: "asc" }, { invoice_number: "asc" }],
  });

  const reportDate = DateTime.now().setZone(TIMEZONE).toFormat("dd/MM/yyyy");

  const rows = bills.map((bill, index) => ({
    serial_number: index + 1,
    date: reportDate,
    service_product: getServiceProductLabel(bill.bill_line_items),
    invoice_number: bill.invoice_number,
    invoice_date: bill.invoice_date
      ? DateTime.fromJSDate(bill.invoice_date, { zone: "utc" }).toFormat("dd/MM/yyyy")
      : "",
    basic_amount: toNumber(bill.taxable_after_discount),
    payment_mode: PAYMENT_MODE_LABELS[bill.payment_mode] || "",
    gst_amount: toNumber(bill.total_tax),
    total_amount: toNumber(bill.grand_total),
  }));

  if (rows.length > 0) {
    const sum = (key) => toNumber(rows.reduce((acc, r) => acc + r[key], 0));
    rows.push({
      serial_number: "",
      date: "",
      service_product: "",
      invoice_number: "",
      invoice_date: "TOTAL",
      basic_amount: sum("basic_amount"),
      payment_mode: "",
      gst_amount: sum("gst_amount"),
      total_amount: sum("total_amount"),
    });
  }

  return { totalRecords: bills.length, rows };
};
