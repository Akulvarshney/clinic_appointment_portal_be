import { DateTime } from "luxon";
import { sendExcelDownload } from "../util/excelExport.js";
import { getAllowedFeaturesForUser } from "../util/permissions.js";
import { getInvoiceReportData } from "../services/invoiceReportService.js";

export const downloadInvoiceReportController = async (req, res) => {
  try {
    const { orgId, fromDate, toDate } = req.query;

    if (!orgId) {
      return res
        .status(400)
        .json({ message: "Organization ID (orgId) is required" });
    }
    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required" });
    }

    const allowed = await getAllowedFeaturesForUser(req.userId, orgId, "BILLING");
    if (!allowed.has("DOWNLOAD_INVOICE_REPORT")) {
      return res
        .status(403)
        .json({ message: "You do not have permission to download the invoice report" });
    }

    const { rows } = await getInvoiceReportData({ orgId, fromDate, toDate });

    const stamp = DateTime.now().setZone("Asia/Kolkata").toFormat("dd-LLLL-yy_HH:mm");

    sendExcelDownload(res, {
      filename: `invoice_report_${fromDate}_to_${toDate}_${stamp}`,
      sheetName: "Invoice Report",
      columns: [
        { header: "S.NO", key: "serial_number", width: 8 },
        { header: "Date", key: "date", width: 14 },
        { header: "Service / Product", key: "service_product", width: 40 },
        { header: "Invoice Number", key: "invoice_number", width: 18 },
        { header: "Invoice Date", key: "invoice_date", width: 14 },
        { header: "Basic Amount", key: "basic_amount", width: 14 },
        { header: "Cash/Card/UPI", key: "payment_mode", width: 14 },
        { header: "GST Amount", key: "gst_amount", width: 14 },
        { header: "Total amount", key: "total_amount", width: 14 },
      ],
      rows,
    });
  } catch (error) {
    console.error("downloadInvoiceReportController:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal Server Error",
    });
  }
};
