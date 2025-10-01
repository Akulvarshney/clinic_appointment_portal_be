import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Resolve font path (adjust if your file structure differs)
const fontPath = path.join(process.cwd(), "fonts", "NotoSans-Regular.ttf");

const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-GB");
};

const withRupee = (value) => {
  if (value == null || value === "N/A") return "N/A";
  const numStr = String(value).trim();
  if (numStr === "" || numStr === "0" || numStr === "0.00") return "0.00";
  return `${numStr}`;
};

export const generateInvoicePdf = async (req, res) => {
  const { billId } = req.params;
  if (!billId) return res.status(400).json({ error: "Bill ID is required" });

  try {
    const bill = await prisma.bills.findUnique({
      where: { id: billId },
      include: { bill_line_items: true, organizations: true, clients: true },
    });

    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
    });

    // Register font that supports ₹
    if (fs.existsSync(fontPath)) {
      doc.registerFont("NotoSans", fontPath);
      const font = "NotoSans";
    } else {
      console.warn(
        "NotoSans font not found! ₹ symbol may not render correctly."
      );
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=invoice_${bill.invoice_number}.pdf`
    );
    doc.pipe(res);

    // Use the custom font throughout
    const baseFont = fs.existsSync(fontPath) ? "NotoSans" : "Helvetica";

    const leftMargin = 50;
    const usableWidth = doc.page.width - leftMargin - 50;

    // === Company Name (Top) ===
    const org = bill.organizations;
    if (org?.company_name || org?.name) {
      doc
        .font(baseFont)
        .fontSize(24)
        .text(org.company_name || org.name, { align: "center" });
      doc.moveDown(0.2);
    }

    if (org) {
      const orgInfo = [
        org.billing_address,
        org.billing_phone ? `Phone: ${org.billing_phone}` : "",
        org.billing_email ? `Email: ${org.billing_email}` : "",
        org.gstnumber ? `GST: ${org.gstnumber}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      if (orgInfo) {
        doc.fontSize(10).text(orgInfo, { align: "center" });
        doc.moveDown(1);
      }
    }

    const typeOFBill = bill.bill_type === "INVOICE" ? "INVOICE" : "QUOTATION";

    // === Invoice Title ===
    doc
      .fontSize(20)
      .font(baseFont + "-Bold") // Note: You may need NotoSans-Bold.ttf for bold
      .text(typeOFBill, { align: "center" });
    doc.moveDown(1);

    // For bold text without separate bold font, use .font(baseFont) and simulate with weight if needed
    // But for simplicity, we'll use regular font everywhere unless you add bold variant

    doc.fontSize(10).font(baseFont);
    doc.text(`Invoice: #${bill.invoice_number}`, { align: "right" });
    doc.text(`Date: ${formatDate(bill.invoice_date)}`, { align: "right" });
    doc.moveDown(2);

    // === Bill From / To ===
    const colWidth = (usableWidth - 20) / 2;
    const tableTop = doc.y;
    doc.fontSize(11);
    doc.text("Bill From:", leftMargin, tableTop);
    doc.text(bill.bill_from_text || "N/A", leftMargin, tableTop + 15, {
      width: colWidth,
      height: 60,
    });
    doc.text("Bill To:", leftMargin + colWidth + 20, tableTop);
    doc.text(
      bill.bill_to_text || "N/A",
      leftMargin + colWidth + 20,
      tableTop + 15,
      { width: colWidth, height: 60 }
    );
    doc.moveDown(3);

    // === Dynamic Columns ===
    const isIntraState =
      parseFloat(bill.total_cgst) > 0 || parseFloat(bill.total_sgst) > 0;

    const baseCols = [
      { label: "Service", width: 0.2, key: "service_name" },
      { label: "Qty", width: 0.06, key: "quantity", align: "right" },
      { label: "Rate", width: 0.1, key: "rate", align: "right" },
      {
        label: "Disc",
        width: 0.12,
        key: "line_discount_share",
        align: "right",
      },
      { label: "Taxable", width: 0.12, key: "taxable_amount", align: "right" },
    ];

    const taxCols = isIntraState
      ? [
          { label: "CGST", width: 0.12, key: "cgst_amount", align: "right" },
          { label: "SGST", width: 0.12, key: "sgst_amount", align: "right" },
        ]
      : [{ label: "IGST", width: 0.24, key: "igst_amount", align: "right" }];

    const totalCol = {
      label: "Total",
      width: 0.16,
      key: "final_amount",
      align: "right",
    };

    const cols = [...baseCols, ...taxCols, totalCol];
    const colWidths = cols.map((col) => col.width * usableWidth);
    const rowHeight = 20;
    let y = doc.y;

    // --- Header Row ---
    doc.fontSize(9).font(baseFont);
    let x = leftMargin;
    cols.forEach((col, i) => {
      doc.text(col.label, x, y, {
        width: colWidths[i],
        align: col.align || "left",
      });
      x += colWidths[i];
    });
    y += rowHeight + 4;

    // --- Data Rows ---
    bill.bill_line_items.forEach((item) => {
      x = leftMargin;
      cols.forEach((col, i) => {
        let value = "N/A";
        if (col.key === "service_name") {
          value = item.service_name || item.description || "N/A";
        } else {
          const isMonetary = [
            "rate",
            "taxable_amount",
            "cgst_amount",
            "sgst_amount",
            "igst_amount",
            "final_amount",
            "line_discount_share", // ← Included here
          ].includes(col.key);
          value = isMonetary
            ? withRupee(item[col.key])
            : String(item[col.key] ?? "N/A");
        }
        doc.fontSize(9).text(value, x, y, {
          width: colWidths[i],
          align: col.align || "left",
        });
        x += colWidths[i];
      });
      y += rowHeight;
    });

    doc.y = y + 10;

    // === Summary Section ===
    const summaryRight = leftMargin + usableWidth;
    let currentY = doc.y;

    const addRow = (label, value, bold = false) => {
      doc.fontSize(bold ? 12 : 10).font(baseFont);
      doc.text(label, leftMargin, currentY, { width: usableWidth - 120 });
      doc.text(value, summaryRight - 100, currentY, {
        width: 100,
        align: "right",
      });
      currentY += bold ? 20 : 15;
    };

    addRow("Sub Total", withRupee(bill.sub_total));
    if (
      String(bill.discount_amount) !== "0" &&
      String(bill.discount_amount) !== "0.00"
    ) {
      addRow(
        `Discount (${bill.discount_percentage}%)`,
        `${withRupee(bill.discount_amount)}`
      );
    }
    addRow("Taxable After Discount", withRupee(bill.taxable_after_discount));
    addRow("Total Tax", withRupee(bill.total_tax));

    if (
      String(bill.shipping_charges) !== "0" &&
      String(bill.shipping_charges) !== "0.00"
    ) {
      addRow("Shipping", withRupee(bill.shipping_charges));
    }

    if (
      bill.round_off_enabled &&
      String(bill.round_off_amount) !== "0" &&
      String(bill.round_off_amount) !== "0.00"
    ) {
      const roValue = String(bill.round_off_amount);
      const formattedRO = roValue.startsWith("-")
        ? `- ${roValue.substring(1)}`
        : `+ ${roValue}`;
      addRow("Round Off", formattedRO);
    }

    addRow("Grand Total", withRupee(bill.grand_total), true);

    // === Notes & Terms ===
    currentY += 20;
    if (bill.notes) {
      doc.fontSize(9).font(baseFont);
      doc.text("Notes:", leftMargin, currentY);
      doc.text(bill.notes, leftMargin, currentY + 12, {
        width: usableWidth,
      });
      currentY += 40;
    }
    if (bill.terms) {
      doc.fontSize(10).font(baseFont);
      doc.text("Notes", leftMargin, currentY);
      doc.text(bill.terms, leftMargin, currentY + 12, {
        width: usableWidth,
      });
      currentY += 40;
    }

    // === Signature / Stamp ===
    // Place signature block ~100px from bottom, but below current content
    const minSignatureY = doc.page.height - 120; // 120px from bottom
    const signatureY = Math.max(currentY + 20, minSignatureY);

    doc.fontSize(10).font(baseFont);

    // Left: "For [Company Name]"
    const forText = "For " + (org?.company_name || org?.name || "");
    doc.text(forText, leftMargin, signatureY);

    // Right: Signature area (aligned to right side)
    const signatureAreaRight = leftMargin + usableWidth; // right edge of content
    const signatureAreaWidth = 200; // width of signature box
    const signatureAreaLeft = signatureAreaRight - signatureAreaWidth;

    // Label: "Authorized Signature"
    doc.text("Authorized Signature", signatureAreaLeft, signatureY, {
      width: signatureAreaWidth,
      align: "center",
    });

    // Signature line (centered under the label)
    const lineY = signatureY + 15;
    doc
      .moveTo(signatureAreaLeft, lineY)
      .lineTo(signatureAreaRight, lineY)
      .dash(2, { space: 2 })
      .stroke()
      .undash();

    doc.end();
  } catch (error) {
    console.error("PDF Error:", error);
    res.status(500).json({ error: "PDF generation failed" });
  }
};

export const generateThermalInvoicePdf = async (req, res) => {
  const { billId } = req.params;
  if (!billId) return res.status(400).json({ error: "Bill ID is required" });

  try {
    const bill = await prisma.bills.findUnique({
      where: { id: billId },
      include: { bill_line_items: true, organizations: true, clients: true },
    });

    if (!bill) return res.status(404).json({ error: "Bill not found" });

    // === PDF INIT (big height, buffered) ===
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
    });

    doc.addPage({
      size: [226, 1000], // very tall page initially
      margins: { top: 10, bottom: 10, left: 8, right: 8 },
    });

    let baseFont = "Helvetica";
    if (fs.existsSync(fontPath)) {
      doc.registerFont("NotoSans", fontPath);
      baseFont = "NotoSans";
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=thermal_invoice_${bill.invoice_number}.pdf`
    );
    doc.pipe(res);

    // === Helpers ===
    const printLine = (label, value, options = {}) => {
      const y = doc.y;
      doc
        .fontSize(options.size || 8)
        .font(options.bold ? `${baseFont}-Bold` : baseFont)
        .text(label, 8, y, { continued: false, width: 120 });
      doc
        .fontSize(options.size || 8)
        .font(baseFont)
        .text(value, 130, y, { align: "right", width: 88 });
    };

    const drawDashedLine = () => {
      const y = doc.y;
      for (let i = 8; i < 218; i += 6) {
        doc
          .moveTo(i, y)
          .lineTo(i + 3, y)
          .stroke();
      }
      doc.moveDown(0.2);
    };

    const drawLine = () => {
      doc.moveTo(8, doc.y).lineTo(218, doc.y).stroke();
      doc.moveDown(0.2);
    };

    const typeOFBill = bill.bill_type === "INVOICE" ? "INVOICE" : "QUOTATION";

    // === Header ===
    doc.font(`${baseFont}-Bold`).fontSize(18).text(typeOFBill, 8, doc.y, {
      align: "center",
      width: 210,
    });
    doc.moveDown(0.4);

    const org = bill.organizations;
    if (org?.company_name || org?.name) {
      doc
        .font(`${baseFont}-Bold`)
        .fontSize(12)
        .text(org.company_name || org.name, 8, doc.y, {
          align: "center",
          width: 210,
        });
      doc.moveDown(0.3);
    }

    const orgInfo = [
      org?.billing_address,
      org?.billing_phone ? `Ph: ${org.billing_phone}` : "",
      org?.billing_email ? `Email: ${org.billing_email}` : "",
      org?.gstnumber ? `GSTIN: ${org.gstnumber}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    if (orgInfo) {
      doc.font(baseFont).fontSize(7).text(orgInfo, 8, doc.y, {
        align: "center",
        width: 210,
      });
      doc.moveDown(0.4);
    }

    // Separator line
    drawLine();
    doc.moveDown(0.2);

    // Invoice Meta
    doc.fontSize(8);
    printLine("Invoice No:", bill.invoice_number);
    printLine("Date:", formatDate(bill.invoice_date));
    doc.moveDown(0.3);

    // === Bill From ===
    if (bill.bill_from_text) {
      drawDashedLine();
      doc.moveDown(0.1);
      doc.font(`${baseFont}-Bold`).fontSize(8).text("BILL FROM:", 8, doc.y, {
        align: "left",
        width: 210,
      });
      doc.moveDown(0.1);
      doc.font(baseFont).fontSize(7).text(bill.bill_from_text, 8, doc.y, {
        width: 210,
        align: "left",
      });
      doc.moveDown(0.3);
    }

    // === Bill To ===
    if (bill.bill_to_text) {
      drawDashedLine();
      doc.moveDown(0.1);
      doc.font(`${baseFont}-Bold`).fontSize(8).text("BILL TO:", 8, doc.y, {
        align: "left",
        width: 210,
      });
      doc.moveDown(0.1);
      doc.font(baseFont).fontSize(7).text(bill.bill_to_text, 8, doc.y, {
        width: 210,
        align: "left",
      });
      doc.moveDown(0.3);
    }

    // === Tax Type ===
    const isIntraState =
      (bill.total_cgst && parseFloat(bill.total_cgst) > 0) ||
      (bill.total_sgst && parseFloat(bill.total_sgst) > 0);

    // === Line Items ===
    drawLine();
    doc.moveDown(0.2);

    bill.bill_line_items.forEach((item, index) => {
      const lineNumber = index + 1;
      const desc = item.service_name || item.description || "Item";

      doc
        .font(`${baseFont}-Bold`)
        .fontSize(8)
        .text(`${lineNumber}) ${desc}`, 8, doc.y, {
          width: 210,
          lineBreak: true,
        });

      doc.font(baseFont).fontSize(7);

      const printDetail = (label, value) => {
        if (value && value !== "0" && value !== "0.00") {
          doc.text(`${label}: ${value}`, 20, doc.y, { width: 200 });
        }
      };

      printDetail("Qty", item.quantity || 1);
      printDetail("Rate", withRupee(item.rate));

      if (
        item.line_discount_share &&
        parseFloat(item.line_discount_share) > 0
      ) {
        const discPerc = item.discount_percentage
          ? ` (${item.discount_percentage}%)`
          : "";
        printDetail(`Disc${discPerc}`, withRupee(item.line_discount_share));
      }

      if (item.taxable_amount) {
        printDetail("Taxable", withRupee(item.taxable_amount));
      }

      if (isIntraState) {
        if (item.cgst_amount && parseFloat(item.cgst_amount) > 0) {
          const cgstPerc = item.gst_percentage
            ? ` (${item.gst_percentage / 2}%)`
            : "";
          printDetail(`CGST${cgstPerc}`, withRupee(item.cgst_amount));
        }
        if (item.sgst_amount && parseFloat(item.sgst_amount) > 0) {
          const sgstPerc = item.gst_percentage
            ? ` (${item.gst_percentage / 2}%)`
            : "";
          printDetail(`SGST${sgstPerc}`, withRupee(item.sgst_amount));
        }
      } else {
        if (item.igst_amount && parseFloat(item.igst_amount) > 0) {
          const igstPerc = item.gst_percentage
            ? ` (${item.gst_percentage}%)`
            : "";
          printDetail(`IGST${igstPerc}`, withRupee(item.igst_amount));
        }
      }

      printDetail("Total", withRupee(item.final_amount));

      doc.moveDown(0.3);

      if (index < bill.bill_line_items.length - 1) {
        drawDashedLine();
        doc.moveDown(0.2);
      }
    });

    drawLine();
    doc.moveDown(0.2);

    // === Summary ===
    printLine("Sub Total:", withRupee(bill.sub_total));

    if (bill.discount_amount && bill.discount_amount !== "0") {
      printLine(
        `Discount (${bill.discount_percentage}%):`,
        `-${withRupee(bill.discount_amount)}`
      );
    }

    if (bill.taxable_after_discount) {
      printLine("Taxable:", withRupee(bill.taxable_after_discount));
    }

    if (isIntraState) {
      if (bill.total_cgst && parseFloat(bill.total_cgst) > 0) {
        printLine("CGST:", withRupee(bill.total_cgst));
      }
      if (bill.total_sgst && parseFloat(bill.total_sgst) > 0) {
        printLine("SGST:", withRupee(bill.total_sgst));
      }
    } else {
      if (bill.total_igst && parseFloat(bill.total_igst) > 0) {
        printLine("IGST:", withRupee(bill.total_igst));
      }
    }

    if (bill.shipping_charges && bill.shipping_charges !== "0") {
      printLine("Shipping:", withRupee(bill.shipping_charges));
    }

    if (bill.round_off_amount && bill.round_off_amount !== "0") {
      const roundOffValue = parseFloat(bill.round_off_amount);
      printLine(
        "Round Off:",
        `${roundOffValue >= 0 ? "+" : ""}${withRupee(bill.round_off_amount)}`
      );
    }

    doc.moveDown(0.2);
    drawLine();
    doc.moveDown(0.2);

    // Grand total
    const totalY = doc.y;
    doc
      .font(`${baseFont}-Bold`)
      .fontSize(10)
      .text("GRAND TOTAL", 8, totalY, { width: 120 });
    doc.fontSize(12).text(withRupee(bill.grand_total), 130, totalY, {
      align: "right",
      width: 88,
    });

    doc.moveDown(0.4);
    drawLine();
    doc.moveDown(0.5);

    // === Footer ===
    doc
      .font(baseFont)
      .fontSize(8)
      .text("Thank you for your business!", 8, doc.y, {
        align: "center",
        width: 210,
      });
    doc.moveDown(0.2);
    doc.fontSize(6).text("This is a computer-generated invoice.", 8, doc.y, {
      align: "center",
      width: 210,
    });
    doc.moveDown(0.3);

    doc.fontSize(8).text("* * * * * * * * * * * *", 8, doc.y, {
      align: "center",
      width: 210,
    });

    // === Resize dynamically ===
    const usedHeight = doc.y + 40; // add padding
    doc.page.size = [226, usedHeight];

    // End stream
    doc.end();
  } catch (error) {
    console.error("Thermal PDF Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "PDF generation failed" });
    }
  }
};
