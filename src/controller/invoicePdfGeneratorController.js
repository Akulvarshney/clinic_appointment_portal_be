import prisma from "../prisma.js";
import { billLineItemsOrderBy } from "../services/billInventoryService.js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

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

/** Bill lines that sell stock (no GST on inventory in this product). */
function isInventoryBillLine(item) {
  return (
    item.line_kind === "INVENTORY" ||
    (item.inventory_item_id != null && item.service_id == null)
  );
}

function isDeletedInvoice(bill) {
  return bill.bill_type === "INVOICE" && bill.billStatus === "DELETED";
}

function drawRotatedLabel(doc, label, centerX, centerY, fontSize, angleDeg) {
  doc.fontSize(fontSize);
  const totalWidth = doc.widthOfString(label);
  const startX = centerX - totalWidth / 2;
  const y = centerY - fontSize / 2;

  doc.rotate(angleDeg, { origin: [centerX, centerY] });

  let x = startX;
  for (const char of label) {
    const charWidth = doc.widthOfString(char);
    doc.text(char, x, y, {
      lineBreak: false,
      width: charWidth + 2,
    });
    x += charWidth;
  }
}

function drawDeletedWatermark(doc, baseFont, { variant = "a4" } = {}) {
  const { width, height } = doc.page;
  const label = "CANCELLED";

  doc.save();
  doc.opacity(0.18);
  doc.fillColor("#888888");
  doc.font(baseFont);

  if (variant === "thermal") {
    const topMargin = 95;
    const fontSize = 32;
    const centerX = width / 2;
    const centerY = topMargin + fontSize / 2;
    drawRotatedLabel(doc, label, centerX, centerY, fontSize, -45);
  } else {
    const fontSize = 80;
    const centerX = width / 2;
    const centerY = height / 2;
    drawRotatedLabel(doc, label, centerX, centerY, fontSize, -45);
  }

  doc.restore();
}

function applyDeletedWatermarkToAllPages(doc, baseFont, options = {}) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawDeletedWatermark(doc, baseFont, options);
  }
}

export const generateInvoicePdf = async (req, res) => {
  const { billId } = req.params;
  if (!billId) return res.status(400).json({ error: "Bill ID is required" });

  try {
    const bill = await prisma.bills.findUnique({
      where: { id: billId },
      include: {
        bill_line_items: {
          orderBy: billLineItemsOrderBy,
          include: { inventory_batches: true },
        },
        organizations: true,
        clients: true,
      },
    });
    console.log("bill suman ", bill);

    if (!bill) return res.status(404).json({ error: "Bill not found" });

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      bufferPages: true,
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

    const typeOFBill = bill.bill_type === "INVOICE" ? "INVOICE" : "PERFORMA INVOICE";

    doc
      .font(baseFont)
      .fontSize(24)
      .text(
        bill?.brand_name_text
          ? bill?.brand_name_text
          : org?.company_name || org?.name,
        { align: "center" }
      );
    doc.moveDown(0.2);

    // if (org) {
    //   const orgInfo = [
    //     org.billing_address,
    //     org.billing_phone ? `Phone: ${org.billing_phone}` : "",
    //     org.billing_email ? `Email: ${org.billing_email}` : "",
    //   ]
    //     .filter(Boolean)
    //     .join("\n");
    //   if (orgInfo) {
    //     doc.fontSize(10).text(orgInfo, { align: "center" });
    //     doc.moveDown(1);
    //   }
    // }

    // === Invoice Title ===
    doc
      .fontSize(14)
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
    });
    doc.text("Bill To:", leftMargin + colWidth + 20, tableTop);
    doc.text(
      bill.bill_to_text || "N/A",
      leftMargin + colWidth + 20,
      tableTop + 15,
      { width: colWidth }
    );
    doc.moveDown(3);

    // === Dynamic Columns ===
    const isIntraState =
      parseFloat(bill.total_cgst) > 0 || parseFloat(bill.total_sgst) > 0;

    const serviceCols = [
      { label: "Service", width: 0.22, key: "service_name" },
      { label: "Qty", width: 0.05, key: "quantity", align: "right" },
      { label: "Rate", width: 0.08, key: "rate", align: "right" },
      { label: "GST", width: 0.07, key: "gst_percentage", align: "right" },
      {
        label: "Disc",
        width: 0.09,
        key: "line_discount_share",
        align: "right",
      },
      { label: "Taxable", width: 0.09, key: "taxable_amount", align: "right" },
    ];

    const taxCols = isIntraState
      ? [
        { label: "CGST", width: 0.09, key: "cgst_amount", align: "right" },
        { label: "SGST", width: 0.09, key: "sgst_amount", align: "right" },
      ]
      : [{ label: "IGST", width: 0.18, key: "igst_amount", align: "right" }];

    const totalCol = {
      label: "Total",
      width: 0.14,
      key: "final_amount",
      align: "right",
    };

    const finalServiceCols = [...serviceCols, ...taxCols, totalCol];

    const inventoryCols = [
      { label: "Item", width: 0.40, key: "service_name" },
      { label: "Qty", width: 0.10, key: "quantity", align: "right" },
      { label: "MRP", width: 0.15, key: "mrp", align: "right" },
      { label: "Rate", width: 0.15, key: "rate", align: "right" },
      { label: "Total", width: 0.20, key: "final_amount", align: "right" },
    ];
    console.log("bill.bill_line_items siddhant ", bill.bill_line_items);
    const serviceItems = bill.bill_line_items.filter(item => !isInventoryBillLine(item));
    const inventoryItems = bill.bill_line_items.filter(item => isInventoryBillLine(item));
   // console.log("serviceItems siddhant ", serviceItems);
    console.log("inventoryItems siddhant ", inventoryItems);

    let y = doc.y;

    const renderTable = (items, cols, title) => {
      if (items.length === 0) return y;

      if (title) {
        doc.fontSize(11).font(baseFont + "-Bold").text(title, leftMargin, y);
        y += 20;
      }

      const colWidths = cols.map((col) => col.width * usableWidth);
      const rowHeight = 20;

      // --- Header Row ---
      doc.fontSize(9).font(baseFont + "-Bold");
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
      doc.font(baseFont);
      items.forEach((item) => {
        x = leftMargin;
        cols.forEach((col, i) => {
          let value = "N/A";
          if (col.key === "service_name") {
            value = item.service_name || item.description || "N/A";
          } else if (col.key === "quantity") {
            const qty = parseFloat(item.quantity);
            value = Number.isFinite(qty)
              ? qty % 1 === 0
                ? String(qty)
                : qty.toFixed(3).replace(/\.?0+$/, "")
              : "N/A";
          } else if (col.key === "mrp") {
            value = withRupee(item.inventory_batches?.mrp);
          } else if (col.key === "gst_percentage") {
            const pct = item.gst_percentage;
            value = pct != null ? `${pct}%` : "N/A";
          } else {
            const isMonetary = [
              "mrp",
              "rate",
              "amount",
              "taxable_amount",
              "cgst_amount",
              "sgst_amount",
              "igst_amount",
              "final_amount",
              "line_discount_share",
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

      y += 15;
      return y;
    };

    y = renderTable(serviceItems, finalServiceCols, "Services");
    y = renderTable(inventoryItems, inventoryCols, "Retail");

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
    if (bill.bank_charges != "" && bill.bank_charges) {
      addRow("Bank Charges (2%)", withRupee(bill.bank_charges));
    }

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
    // if (bill.notes) {
    //   doc.fontSize(9).font(baseFont);
    //   doc.text("Notes:", leftMargin, currentY);
    //   doc.text(bill.notes, leftMargin, currentY + 12, {
    //     width: usableWidth,
    //   });
    //   currentY += 40;
    // }
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
    const forText = "For " + (bill?.brand_name_text || org?.name || "");
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

    if (isDeletedInvoice(bill)) {
      applyDeletedWatermarkToAllPages(doc, baseFont);
    }

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
      include: {
        bill_line_items: { orderBy: billLineItemsOrderBy },
        organizations: true,
        clients: true,
      },
    });

    if (!bill) return res.status(404).json({ error: "Bill not found" });

    // === PDF INIT ===
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
    });

    doc.addPage({
      size: [226, 1000],
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

    const typeOFBill = bill.bill_type === "INVOICE" ? "INVOICE" : "PERFORMA INVOICE";
    const org = bill.organizations;

    doc
      .font(`${baseFont}-Bold`)
      .fontSize(12)
      .text(
        bill?.brand_name_text || org?.company_name || org?.name || "",
        8,
        doc.y,
        { align: "center", width: 210 }
      );
    doc.moveDown(0.3);

    // === Header ===
    doc.font(`${baseFont}-Bold`).fontSize(10).text(typeOFBill, 8, doc.y, {
      align: "center",
      width: 210,
    });
    doc.moveDown(0.4);

    // const orgInfo = [
    //   org?.billing_address,
    //   org?.billing_phone ? `Ph: ${org.billing_phone}` : "",
    //   org?.billing_email ? `Email: ${org.billing_email}` : "",
    //   typeOFBill === "INVOICE" && org?.gstnumber ? `GST: ${org.gstnumber}` : "",
    // ]
    //   .filter(Boolean)
    //   .join("\n");

    // if (orgInfo) {
    //   doc.font(baseFont).fontSize(7).text(orgInfo, 8, doc.y, {
    //     align: "center",
    //     width: 210,
    //   });
    //   doc.moveDown(0.4);
    // }

    drawLine();
    doc.moveDown(0.2);

    // === Invoice Meta ===
    printLine("Invoice No:", bill.invoice_number);
    printLine("Date:", formatDate(bill.invoice_date));
    doc.moveDown(0.3);

    // === Bill From / To ===
    if (bill.bill_from_text) {
      drawDashedLine();
      doc.moveDown(0.1);
      doc.font(`${baseFont}-Bold`).fontSize(8).text("BILL FROM:", 8, doc.y);
      doc.moveDown(0.1);
      doc.font(baseFont).fontSize(7).text(bill.bill_from_text, 8, doc.y, {
        width: 210,
      });
      doc.moveDown(0.3);
    }

    if (bill.bill_to_text) {
      drawDashedLine();
      doc.moveDown(0.1);
      doc.font(`${baseFont}-Bold`).fontSize(8).text("BILL TO:", 8, doc.y);
      doc.moveDown(0.1);
      doc.font(baseFont).fontSize(7).text(bill.bill_to_text, 8, doc.y, {
        width: 210,
      });
      doc.moveDown(0.3);
    }

    // === Line Items ===
    drawLine();
    doc.moveDown(0.2);

    const isIntraState =
      (bill.total_cgst && parseFloat(bill.total_cgst) > 0) ||
      (bill.total_sgst && parseFloat(bill.total_sgst) > 0);

    const renderThermalItems = (items, title) => {
      if (items.length === 0) return;

      if (title) {
        doc.font(`${baseFont}-Bold`).fontSize(9).text(title, 8, doc.y, { width: 210, underline: true });
        doc.moveDown(0.3);
      }

      items.forEach((item, index) => {
        const desc = item.service_name || item.description || "Item";
        doc
          .font(`${baseFont}-Bold`)
          .fontSize(8)
          .text(`${index + 1}) ${desc}`, 8, doc.y, {
            width: 210,
            lineBreak: true,
          });

        doc.font(baseFont).fontSize(7);

        const printDetail = (label, value) => {
          if (
            value != null &&
            value !== "" &&
            value !== "0" &&
            value !== "0.00"
          ) {
            doc.text(`${label}: ${value}`, 20, doc.y, { width: 200 });
          }
        };

        if (isInventoryBillLine(item)) {
          printDetail("Batch", item.inventory_batch_number || "N/A");
          printDetail("Qty", item.quantity || "1");
          printDetail("Rate", withRupee(item.rate));
          printDetail("Amount", withRupee(item.amount));
          printDetail("Total", withRupee(item.final_amount));
        } else {
          printDetail("Qty", item.quantity || "1");
          printDetail("Rate", withRupee(item.rate));

          if (
            item.gst_percentage != null &&
            item.gst_percentage !== "" &&
            parseFloat(item.gst_percentage) > 0
          ) {
            printDetail("GST", `${item.gst_percentage}%`);
          }

          if (
            item.line_discount_share &&
            parseFloat(item.line_discount_share) > 0
          ) {
            printDetail(`Disc`, withRupee(item.line_discount_share));
          }

          if (item.taxable_amount) {
            printDetail("Taxable", withRupee(item.taxable_amount));
          }

          if (isIntraState) {
            if (item.cgst_amount && parseFloat(item.cgst_amount) > 0) {
              const cgstPerc = item.gst_percentage
                ? ` (${parseFloat(item.gst_percentage) / 2}%)`
                : "";
              printDetail(`CGST${cgstPerc}`, withRupee(item.cgst_amount));
            }
            if (item.sgst_amount && parseFloat(item.sgst_amount) > 0) {
              const sgstPerc = item.gst_percentage
                ? ` (${parseFloat(item.gst_percentage) / 2}%)`
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
        }

        doc.moveDown(0.3);

        if (index < items.length - 1) {
          drawDashedLine();
          doc.moveDown(0.2);
        }
      });
    };

    const serviceItems = bill.bill_line_items.filter(item => !isInventoryBillLine(item));
    const inventoryItems = bill.bill_line_items.filter(item => isInventoryBillLine(item));

    if (serviceItems.length > 0) {
      renderThermalItems(serviceItems, "Services");
    }

    if (inventoryItems.length > 0) {
      if (serviceItems.length > 0) {
        drawDashedLine();
        doc.moveDown(0.2);
      }
      renderThermalItems(inventoryItems, "Retail");
    }

    drawLine();
    doc.moveDown(0.2);

    // === Summary Section ===
    printLine("Sub Total:", withRupee(bill.sub_total));


    if (
      bill.discount_amount &&
      String(bill.discount_amount) !== "0" &&
      String(bill.discount_amount) !== "0.00"
    ) {
      printLine(
        `Discount (${bill.discount_percentage}%):`,
        `-${withRupee(bill.discount_amount)}`
      );
    }

    if (bill.taxable_after_discount) {
      printLine(
        "Taxable After Discount:",
        withRupee(bill.taxable_after_discount)
      );
    }

    // ➕ Add "Total Tax" line (like in A4)
    if (
      bill.total_tax &&
      String(bill.total_tax) !== "0" &&
      String(bill.total_tax) !== "0.00"
    ) {
      printLine("Total Tax:", withRupee(bill.total_tax));
    }



    // Breakdown only if needed (already shown above, but A4 shows both — keep for clarity)
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
    if (bill.bank_charges != "" && bill.bank_charges) {
      printLine("Bank Charges (2%)", withRupee(bill.bank_charges));
    }

    if (
      bill.shipping_charges &&
      String(bill.shipping_charges) !== "0" &&
      String(bill.shipping_charges) !== "0.00"
    ) {
      printLine("Shipping:", withRupee(bill.shipping_charges));
    }

    if (
      bill.round_off_enabled &&
      bill.round_off_amount &&
      String(bill.round_off_amount) !== "0" &&
      String(bill.round_off_amount) !== "0.00"
    ) {
      const roValue = parseFloat(bill.round_off_amount);
      const formattedRO =
        roValue >= 0 ? `+${withRupee(roValue)}` : withRupee(roValue);
      printLine("Round Off:", formattedRO);
    }

    doc.moveDown(0.2);
    drawLine();
    doc.moveDown(0.2);

    // Grand Total
    const totalY = doc.y;
    doc.font(`${baseFont}-Bold`).fontSize(10).text("GRAND TOTAL", 8, totalY, {
      width: 120,
    });
    doc.fontSize(12).text(withRupee(bill.grand_total), 130, totalY, {
      align: "right",
      width: 88,
    });

    doc.moveDown(0.4);
    drawLine();
    doc.moveDown(0.3);

    // === Notes & Terms ===
    // if (bill.notes || bill.terms) {
    //   if (bill.notes) {
    //     doc.font(baseFont).fontSize(8).text("Notes:", 8, doc.y);
    //     doc.fontSize(7).text(bill.notes, 8, doc.y + 10, { width: 210 });
    //     doc.moveDown(0.5);
    //   }
    //   if (bill.terms) {
    //     doc.fontSize(8).text("Terms:", 8, doc.y);
    //     doc.fontSize(7).text(bill.terms, 8, doc.y + 10, { width: 210 });
    //     doc.moveDown(0.5);
    //   }
    //   drawLine();
    //   doc.moveDown(0.2);
    // }

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

    // === Finalize Page Height ===
    const usedHeight = doc.y + 30;
    doc.page.size = [226, usedHeight];

    if (isDeletedInvoice(bill)) {
      applyDeletedWatermarkToAllPages(doc, baseFont, { variant: "thermal" });
    }

    doc.end();
  } catch (error) {
    console.error("Thermal PDF Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "PDF generation failed" });
    }
  }
};

export const generateReceiptPdf = async (req, res) => {
  const { receiptId } = req.params;
  if (!receiptId) {
    return res.status(400).json({ error: "Receipt ID is required" });
  }

  try {
    const receipt = await prisma.receipts.findUnique({
      where: { id: receiptId },
      include: {
        receipt_bill_line_items: {
          include: { services: true },
        },
        clients: true,
      },
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const organization = await prisma.organizations.findUnique({
      where: { id: receipt.organization_id },
    });

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=receipt_${receipt.receipt_id}.pdf`
    );
    doc.pipe(res);

    const leftMargin = 50;
    const pageWidth = doc.page.width;
    const usableWidth = pageWidth - leftMargin - 50;

    // === ORGANIZATION HEADER ===
    const orgName = receipt?.brand_name_text || "";
    doc.fontSize(20).font("Helvetica-Bold").text(orgName, { align: "center" });
    doc.moveDown(0.2);

    // const orgDetails = [
    //   organization.billing_address,
    //   organization.billing_phone ? `📞 ${organization.billing_phone}` : "",
    //   organization.billing_email ? `✉️ ${organization.billing_email}` : "",
    //   organization.gstnumber ? `GSTIN: ${organization.gstnumber}` : "",
    // ]
    //   .filter(Boolean)
    //   .join("\n");

    // if (orgDetails) {
    //   doc.fontSize(9).font("Helvetica").text(orgDetails, { align: "center" });
    // }
    // doc.moveDown(1.2);

    // === RECEIPT TITLE & INFO ===
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("OFFICIAL PAYMENT RECEIPT", { align: "center" });
    doc.moveDown(0.8);

    doc.fontSize(10).font("Helvetica");
    doc.text(`Receipt No: ${receipt.receipt_id}`, { align: "right" });
    doc.text(`Date & Time: ${formatDate(receipt.created_at)}`, {
      align: "right",
    });
    doc.text(`Status: ${receipt.is_valid ? "PAID" : "VOID"}`, {
      align: "right",
    });
    doc.moveDown(1.5);

    // === CLIENT SECTION ===
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("Received With Thanks From:", leftMargin, doc.y);
    doc.moveDown(0.3);

    const clientName =
      [receipt.clients.first_name, receipt.clients.last_name]
        .filter(Boolean)
        .join(" ") || "N/A";

    doc.fontSize(10).font("Helvetica");
    doc.text(clientName, leftMargin, doc.y);
    let clientY = doc.y + 14;
    if (receipt.clients.email) {
      doc.text(`Email: ${receipt.clients.email}`, leftMargin, clientY);
      clientY += 14;
    }
    if (receipt.clients.phone) {
      doc.text(`Mobile: ${receipt.clients.phone}`, leftMargin, clientY);
      clientY += 14;
    }
    if (receipt.clients.address) {
      doc.text(`Address: ${receipt.clients.address}`, leftMargin, clientY);
    }

    doc.moveDown(1.8); // Reduced from 2.5

    // === LINE ITEMS TABLE ===
    const cols = [
      { label: "Particulars", width: 0.45, key: "service_name" },
      { label: "Qty", width: 0.1, key: "quantity", align: "center" },
    ];

    const colWidths = cols.map((col) => col.width * usableWidth);
    let y = doc.y;

    // Table Header
    doc.fontSize(9).font("Helvetica-Bold");
    let x = leftMargin;
    cols.forEach((col, i) => {
      doc.text(col.label, x, y, {
        width: colWidths[i],
        align: col.align || "left",
      });
      x += colWidths[i];
    });
    y += 18;

    // Separator line
    doc
      .moveTo(leftMargin, y)
      .lineTo(leftMargin + usableWidth, y)
      .stroke();
    y += 8;

    // Data Rows
    doc.fontSize(9).font("Helvetica");
    receipt.receipt_bill_line_items.forEach((item) => {
      const price = item.services?.price ? parseFloat(item.services.price) : 0;
      const qty = parseFloat(item.quantity);
      const total = qty * price;

      x = leftMargin;
      cols.forEach((col, i) => {
        let value = "";
        if (col.key === "service_name") {
          value = item.service_name || item.services?.name || "Service";
        } else if (col.key === "quantity") {
          value = qty.toFixed(3);
        }

        // else if (col.key === "price") {
        //   value = price.toFixed(2);
        // } else if (col.key === "total") {
        //   value = total.toFixed(2);
        // }

        doc.text(value, x, y, {
          width: colWidths[i],
          align: col.align || "left",
        });
        x += colWidths[i];
      });
      y += 20;
    });

    // === TOTAL AMOUNT BOX (positioned absolutely) ===
    const totalBoxY = y + 15;
    const totalBoxWidth = 220;
    const totalBoxX = pageWidth - totalBoxWidth - 50;

    doc
      .roundedRect(totalBoxX, totalBoxY, totalBoxWidth, 50, 5)
      .strokeColor("#000")
      .lineWidth(1)
      .stroke();

    doc.fontSize(11).font("Helvetica-Bold");
    doc.text("TOTAL AMOUNT", totalBoxX + 15, totalBoxY + 12);
    doc.fontSize(14).font("Helvetica-Bold");
    doc.text(withRupee(receipt.amount), totalBoxX + 15, totalBoxY + 28);

    // === FOOTER SECTION (absolute positioning to prevent page break) ===
    const footerStartY = totalBoxY + 80;

    // Payment acknowledgment
    doc.fontSize(10).font("Helvetica");
    doc.text(
      "This is to certify that the above-mentioned amount has been received in full satisfaction of the services rendered.",
      leftMargin,
      footerStartY,
      { width: usableWidth, align: "center" }
    );

    doc.text(
      "This receipt is valid without signature only if issued electronically through our official system.",
      leftMargin,
      footerStartY + 22,
      { width: usableWidth, align: "center" }
    );

    // Authorized stamp
    const stampY = footerStartY + 60;
    const stampWidth = 200;
    const stampX = (pageWidth - stampWidth) / 2;

    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("FOR & ON BEHALF OF", stampX, stampY, {
      width: stampWidth,
      align: "center",
    });

    doc.fontSize(10).font("Helvetica-Bold");
    doc.text(orgName, stampX, stampY + 12, {
      width: stampWidth,
      align: "center",
    });

    // Signature line
    const lineY = stampY + 28;
    doc
      .moveTo(stampX, lineY)
      .lineTo(stampX + stampWidth, lineY)
      .dash(2, { space: 2 })
      .stroke()
      .undash();

    doc.fontSize(9).font("Helvetica");
    doc.text("Authorized Signatory", stampX, lineY + 5, {
      width: stampWidth,
      align: "center",
    });
    doc.moveDown(2);
    const footerText =
      "This is a system-generated receipt. No signature required.";
    doc.text(footerText, stampX + 5, lineY + 20, {
      width: stampWidth,
      align: "center",
    });

    // Fixed bottom footer note
    // doc.fontSize(8).font("Helvetica").fillColor("#666");
    // const footerText =
    //   "This is a system-generated receipt. No signature required.";
    // doc.text(footerText, 0, doc.page.height - 50, {
    //   width: pageWidth,
    //   align: "center",
    // });

    doc.end();
  } catch (error) {
    console.error("Receipt PDF Generation Error:", error);
    res.status(500).json({ error: "Failed to generate receipt PDF" });
  }
};

export const generateThermalReceiptPdf = async (req, res) => {
  const { receiptId } = req.params;
  if (!receiptId) {
    return res.status(400).json({ error: "Receipt ID is required" });
  }

  try {
    const receipt = await prisma.receipts.findUnique({
      where: { id: receiptId },
      include: {
        receipt_bill_line_items: {
          include: { services: true },
        },
        clients: true,
      },
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    const organization = await prisma.organizations.findUnique({
      where: { id: receipt.organization_id },
    });

    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Thermal paper: 80mm = ~226 points at 72 DPI
    const doc = new PDFDocument({
      size: [226, 842], // Dynamic height, will adjust
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=thermal_receipt_${receipt.receipt_id}.pdf`
    );
    doc.pipe(res);

    const maxWidth = 206; // Usable width (226 - 20 margins)
    const divider = "=".repeat(42);
    const thinDivider = "-".repeat(42);

    // === ORGANIZATION HEADER ===
    const orgName = (receipt.brand_name_text || "").toUpperCase();

    doc.font("Courier-Bold").fontSize(11).text(orgName, { align: "center" });
    doc.moveDown(0.3);

    // === MAIN DIVIDER ===
    doc.font("Courier").fontSize(8).text(divider, { align: "center" });
    doc.moveDown(0.3);

    // === RECEIPT TITLE ===
    doc
      .font("Courier-Bold")
      .fontSize(10)
      .text("OFFICIAL PAYMENT RECEIPT", { align: "center" });
    doc.moveDown(0.3);

    doc.font("Courier").fontSize(8).text(thinDivider, { align: "center" });
    doc.moveDown(0.4);

    // === RECEIPT INFORMATION ===
    doc.font("Courier").fontSize(8);
    doc.text(`Receipt No  : ${receipt.receipt_id}`);
    doc.text(`Date & Time : ${formatDate(receipt.created_at)}`);
    doc.text(`Status      : ${receipt.is_valid ? "PAID" : "VOID"}`);
    doc.moveDown(0.5);

    // === CLIENT INFORMATION ===
    doc.font("Courier-Bold").fontSize(8).text("RECEIVED WITH THANKS FROM:");
    doc.moveDown(0.2);

    const clientName =
      [receipt.clients.first_name, receipt.clients.last_name]
        .filter(Boolean)
        .join(" ") || "N/A";

    doc.font("Courier").fontSize(8);
    doc.text(`Name    : ${wrapText(clientName, 30)}`);

    if (receipt.clients.email) {
      doc.text(`Email   : ${wrapText(receipt.clients.email, 30)}`);
    }
    if (receipt.clients.phone) {
      doc.text(`Mobile  : ${receipt.clients.phone}`);
    }
    if (receipt.clients.address) {
      const wrappedAddress = wrapText(receipt.clients.address, 30);
      const addressLines = wrappedAddress.split("\n");
      addressLines.forEach((line, idx) => {
        if (idx === 0) {
          doc.text(`Address : ${line}`);
        } else {
          doc.text(`          ${line}`);
        }
      });
    }

    doc.moveDown(0.5);

    // === LINE ITEMS TABLE ===
    doc.font("Courier").fontSize(8).text(divider, { align: "center" });
    doc.moveDown(0.3);

    doc.font("Courier-Bold").fontSize(8).text("PARTICULARS");
    doc.moveDown(0.2);

    // Table header with proper alignment
    const headerLine = padRight("Item", 20) + padCenter("Qty", 6);
    // padLeft("Rate", 8) +
    // padLeft("Amt", 8);

    doc.font("Courier-Bold").fontSize(7).text(headerLine);
    doc.font("Courier").fontSize(7).text(thinDivider);
    doc.moveDown(0.1);

    // Line items with proper formatting
    let subtotal = 0;
    receipt.receipt_bill_line_items.forEach((item, index) => {
      const serviceName = item.service_name || item.services?.name || "Service";
      const qty = parseFloat(item.quantity);
      const price = item.services?.price ? parseFloat(item.services.price) : 0;
      const total = qty * price;
      subtotal += total;

      // Wrap service name if too long
      const maxServiceNameLen = 20;
      const wrappedServiceName = wrapText(serviceName, maxServiceNameLen);
      const serviceLines = wrappedServiceName.split("\n");

      // First line with all details
      const firstLine =
        padRight(serviceLines[0], 20) + padCenter(qty.toFixed(3), 6);
      // padLeft(price.toFixed(2), 8) +
      // padLeft(total.toFixed(2), 8);

      doc.font("Courier").fontSize(7).text(firstLine);

      // Additional lines for wrapped service name (if any)
      for (let i = 1; i < serviceLines.length; i++) {
        doc.text(padRight(serviceLines[i], 20));
      }

      doc.moveDown(0.15);
    });

    // === TOTALS SECTION ===
    doc.font("Courier").fontSize(7).text(thinDivider);
    doc.moveDown(0.3);

    doc.font("Courier-Bold").fontSize(9);
    const totalLine =
      padRight("TOTAL AMOUNT:", 22) +
      padLeft(`₹ ${parseFloat(receipt.amount).toFixed(2)}`, 20);
    doc.text(totalLine);
    doc.moveDown(0.3);

    doc.font("Courier").fontSize(8).text(divider, { align: "center" });
    doc.moveDown(0.5);

    // === PAYMENT ACKNOWLEDGMENT ===
    doc.font("Courier").fontSize(7);
    const acknowledgment = wrapText(
      "This is to certify that the above-mentioned amount has been received in full satisfaction of the services rendered.",
      42
    );
    doc.text(acknowledgment, { align: "center" });
    doc.moveDown(0.4);

    const validityNote = wrapText(
      "This receipt is valid without signature as it is electronically generated.",
      42
    );
    doc.text(validityNote, { align: "center" });
    doc.moveDown(0.5);

    // === AUTHORIZED SIGNATURE ===
    doc.font("Courier-Bold").fontSize(7);
    doc.text("FOR & ON BEHALF OF", { align: "center" });
    doc.font("Courier-Bold").fontSize(8);
    doc.text(orgName, { align: "center" });
    doc.moveDown(0.3);

    doc.font("Courier").fontSize(7);
    doc.text("_______________________", { align: "center" });
    doc.text("Authorized Signatory", { align: "center" });
    doc.moveDown(0.5);

    // === FOOTER ===
    doc.font("Courier").fontSize(6);
    doc.text("This is a system-generated receipt.", { align: "center" });
    doc.text("No signature required.", { align: "center" });
    doc.moveDown(0.3);

    doc.text("Thank you for your payment!", { align: "center" });
    doc.moveDown(0.2);

    doc.font("Courier").fontSize(8).text(divider, { align: "center" });

    // Finalize
    doc.end();
  } catch (error) {
    console.error("Thermal Receipt PDF Error:", error);
    res.status(500).json({ error: "Failed to generate thermal receipt PDF" });
  }
};

// === ENHANCED HELPER FUNCTIONS ===

/**
 * Pad string to the right with spaces
 */
function padRight(str, len) {
  str = String(str).substring(0, len); // Truncate if too long
  return str + " ".repeat(Math.max(0, len - str.length));
}

/**
 * Pad string to the left with spaces
 */
function padLeft(str, len) {
  str = String(str).substring(0, len); // Truncate if too long
  return " ".repeat(Math.max(0, len - str.length)) + str;
}

/**
 * Center-align string within given length
 */
function padCenter(str, len) {
  str = String(str).substring(0, len);
  const totalPadding = Math.max(0, len - str.length);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return " ".repeat(leftPadding) + str + " ".repeat(rightPadding);
}

/**
 * Wrap text to specified width
 */
function wrapText(text, maxWidth) {
  if (!text) return "";

  text = String(text);
  if (text.length <= maxWidth) return text;

  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if ((currentLine + word).length <= maxWidth) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      // If single word is longer than maxWidth, truncate it
      currentLine =
        word.length > maxWidth ? word.substring(0, maxWidth - 3) + "..." : word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines.join("\n");
}
