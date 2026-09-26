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

    const leftMargin = 40;
    const rightMargin = 40;
    const topMargin = 40;
    const bottomMargin = 50;

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin },
      bufferPages: true,
    });

    // Register font that supports ₹
    if (fs.existsSync(fontPath)) {
      doc.registerFont("NotoSans", fontPath);
      doc.registerFont("NotoSans-Bold", fontPath);
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

    const baseFont = fs.existsSync(fontPath) ? "NotoSans" : "Helvetica";
    const boldFont = fs.existsSync(fontPath) ? "NotoSans-Bold" : "Helvetica-Bold";

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const usableWidth = pageWidth - leftMargin - rightMargin;

    // Draw Top Accent Stripe (Dual Line)
    const drawPageDecorations = () => {
      doc.save();
      doc.rect(0, 0, pageWidth, 5).fill("#0F172A");
      doc.rect(0, 5, pageWidth, 2).fill("#2563EB");
      doc.restore();
    };

    drawPageDecorations();

    const org = bill.organizations;
    const typeOFBill = bill.bill_type === "INVOICE" ? "INVOICE" : "PERFORMA INVOICE";
    const brandTitle = bill?.brand_name_text ? bill?.brand_name_text : org?.company_name || org?.name || "";

    // === HEADER SECTION ===
    let headerY = 24;

    // Brand Name (Left)
    doc
      .font(boldFont)
      .fontSize(19)
      .fillColor("#0F172A")
      .text(brandTitle, leftMargin, headerY, { width: 310, align: "left" });

    // Type of Bill Badge (Top Right)
    const badgeWidth = 145;
    const badgeHeight = 24;
    const badgeX = pageWidth - rightMargin - badgeWidth;
    const badgeY = headerY;

    const isInvoice = typeOFBill === "INVOICE";
    const badgeBg = isInvoice ? "#EEF2FF" : "#FFFBEB";
    const badgeBorder = isInvoice ? "#C7D2FE" : "#FDE68A";
    const badgeTextColor = isInvoice ? "#3730A3" : "#92400E";

    doc.save();
    doc
      .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 5)
      .fillColor(badgeBg)
      .strokeColor(badgeBorder)
      .lineWidth(1)
      .fillAndStroke();

    doc
      .font(boldFont)
      .fontSize(9)
      .fillColor(badgeTextColor)
      .text(typeOFBill, badgeX, badgeY + 6, {
        width: badgeWidth,
        align: "center",
      });
    doc.restore();

    // Invoice Meta (Right side, under badge)
    let metaY = badgeY + badgeHeight + 8;
    doc
      .font(boldFont)
      .fontSize(9.5)
      .fillColor("#0F172A")
      .text(`Invoice: #${bill.invoice_number}`, leftMargin + 300, metaY, {
        width: 215,
        align: "right",
      });
    metaY += 14;
    doc
      .font(baseFont)
      .fontSize(8.5)
      .fillColor("#64748B")
      .text(`Date: ${formatDate(bill.invoice_date)}`, leftMargin + 300, metaY, {
        width: 215,
        align: "right",
      });

    // === BILL FROM / BILL TO CARDS WITH ACCENT BAR ===
    let cardsY = Math.max(doc.y + 16, 85);

    const cardGap = 15;
    const cardWidth = (usableWidth - cardGap) / 2;

    const billFromText = bill.bill_from_text || "N/A";
    const billToText = bill.bill_to_text || "N/A";

    doc.font(baseFont).fontSize(8.5);
    const heightFrom = doc.heightOfString(billFromText, {
      width: cardWidth - 26,
      lineGap: 2.5,
    });
    const heightTo = doc.heightOfString(billToText, {
      width: cardWidth - 26,
      lineGap: 2.5,
    });
    const cardContentHeight = Math.max(heightFrom, heightTo);
    const cardHeight = Math.max(75, cardContentHeight + 42);

    const drawInfoCard = (x, y, title, content, accentColor) => {
      doc.save();
      doc
        .roundedRect(x, y, cardWidth, cardHeight, 6)
        .fillColor("#F8FAFC")
        .strokeColor("#E2E8F0")
        .lineWidth(1)
        .fillAndStroke();

      doc
        .roundedRect(x, y, 4, cardHeight, 2)
        .fillColor(accentColor);

      doc
        .font(boldFont)
        .fontSize(8)
        .fillColor("#475569")
        .text(title.toUpperCase(), x + 14, y + 10, { width: cardWidth - 26 });

      doc
        .moveTo(x + 14, y + 23)
        .lineTo(x + cardWidth - 14, y + 23)
        .strokeColor("#CBD5E1")
        .lineWidth(0.5)
        .stroke();

      doc
        .font(baseFont)
        .fontSize(8.5)
        .fillColor("#1E293B")
        .text(content, x + 14, y + 28, {
          width: cardWidth - 26,
          lineGap: 2.5,
        });

      doc.restore();
    };

    drawInfoCard(leftMargin, cardsY, "Bill From:", billFromText, "#2563EB");
    drawInfoCard(leftMargin + cardWidth + cardGap, cardsY, "Bill To:", billToText, "#0D9488");

    let currentY = cardsY + cardHeight + 22;

    // === DYNAMIC COLUMNS SETUP ===
    const isIntraState =
      parseFloat(bill.total_cgst) > 0 || parseFloat(bill.total_sgst) > 0;

    const serviceCols = [
      { label: "SERVICE", width: isIntraState ? 0.19 : 0.20, key: "service_name" },
      { label: "QTY", width: 0.05, key: "quantity", align: "right" },
      { label: "RATE", width: isIntraState ? 0.08 : 0.08, key: "rate", align: "right" },
      { label: "GROSS AMT", width: isIntraState ? 0.13 : 0.14, key: "amount", align: "right" },
      { label: "DISC", width: 0.08, key: "line_discount_share", align: "right" },
      { label: "TAXABLE", width: isIntraState ? 0.10 : 0.11, key: "taxable_amount", align: "right" },
      { label: "GST %", width: isIntraState ? 0.07 : 0.08, key: "gst_percentage", align: "right" },
    ];

    const taxCols = isIntraState
      ? [
        { label: "CGST", width: 0.075, key: "cgst_amount", align: "right" },
        { label: "SGST", width: 0.075, key: "sgst_amount", align: "right" },
      ]
      : [{ label: "IGST", width: 0.10, key: "igst_amount", align: "right" }];

    const totalCol = {
      label: "TOTAL",
      width: isIntraState ? 0.15 : 0.16,
      key: "final_amount",
      align: "right",
    };

    const finalServiceCols = [...serviceCols, ...taxCols, totalCol];

    const inventoryCols = [
      { label: "ITEM", width: 0.26, key: "service_name" },
      { label: "QTY", width: 0.07, key: "quantity", align: "right" },
      { label: "MRP", width: 0.12, key: "mrp", align: "right" },
      { label: "RATE", width: 0.13, key: "rate", align: "right" },
      { label: "GROSS AMT", width: 0.20, key: "amount", align: "right" },
      { label: "TOTAL", width: 0.22, key: "final_amount", align: "right" },
    ];

    console.log("bill.bill_line_items siddhant ", bill.bill_line_items);
    const serviceItems = bill.bill_line_items.filter((item) => !isInventoryBillLine(item));
    const inventoryItems = bill.bill_line_items.filter((item) => isInventoryBillLine(item));
    console.log("inventoryItems siddhant ", inventoryItems);

    const renderTable = (items, cols, title) => {
      if (items.length === 0) return currentY;

      if (currentY + 50 > pageHeight - bottomMargin) {
        doc.addPage();
        drawPageDecorations();
        currentY = topMargin + 10;
      }

      if (title) {
        doc.save();
        doc.roundedRect(leftMargin, currentY, 4, 14, 2).fill("#0F172A");
        doc
          .font(boldFont)
          .fontSize(10.5)
          .fillColor("#0F172A")
          .text(title.toUpperCase(), leftMargin + 10, currentY + 1);

        const titleWidth = doc.widthOfString(title.toUpperCase());
        doc
          .moveTo(leftMargin + 16 + titleWidth, currentY + 8)
          .lineTo(leftMargin + usableWidth, currentY + 8)
          .strokeColor("#E2E8F0")
          .lineWidth(0.5)
          .stroke();

        doc.restore();
        currentY += 22;
      }

      const colWidths = cols.map((col) => Math.floor(col.width * usableWidth));
      const sumWidths = colWidths.reduce((a, b) => a + b, 0);
      colWidths[colWidths.length - 1] += usableWidth - sumWidths;

      const headerHeight = 22;

      const drawHeaderRow = (yPos) => {
        doc.save();
        doc
          .roundedRect(leftMargin, yPos, usableWidth, headerHeight, 3)
          .fill("#0F172A");

        let hX = leftMargin;
        cols.forEach((col, i) => {
          const availW = colWidths[i] - 6;
          let fontSize = cols.length > 7 ? 7.2 : 8;
          doc.font(boldFont).fontSize(fontSize);
          while (fontSize > 5.5 && doc.widthOfString(col.label) > availW) {
            fontSize -= 0.3;
            doc.fontSize(fontSize);
          }
          doc.fillColor("#FFFFFF");
          const textY = yPos + (headerHeight - fontSize) / 2 - 0.5;
          doc.text(col.label, hX + 3, textY, {
            width: availW,
            align: col.align || "left",
            lineBreak: false,
          });
          hX += colWidths[i];
        });
        doc.restore();
      };

      // Header Row
      drawHeaderRow(currentY);
      currentY += headerHeight;

      // Data Rows
      items.forEach((item, rowIndex) => {
        const formattedValues = cols.map((col) => {
          if (col.key === "service_name") {
            return item.service_name || item.description || "N/A";
          } else if (col.key === "quantity") {
            const qty = parseFloat(item.quantity);
            return Number.isFinite(qty)
              ? qty % 1 === 0
                ? String(qty)
                : qty.toFixed(3).replace(/\.?0+$/, "")
              : "N/A";
          } else if (col.key === "mrp") {
            return withRupee(item.inventory_batches?.mrp);
          } else if (col.key === "amount") {
            const qty = parseFloat(item.quantity || 0);
            const rate = parseFloat(item.rate != null ? item.rate : 0);
            const totalQtyTimesRate = qty * rate;
            return withRupee(totalQtyTimesRate);
          } else if (col.key === "gst_percentage") {
            const pct = item.gst_percentage;
            return pct != null ? `${pct}%` : "N/A";
          } else if (["cgst_amount", "sgst_amount", "igst_amount"].includes(col.key)) {
            const val = parseFloat(item[col.key]);
            return !isNaN(val) ? val.toFixed(1) : "0.0";
          } else {
            const isMonetary = [
              "mrp",
              "rate",
              "taxable_amount",
              "final_amount",
              "line_discount_share",
            ].includes(col.key);
            return isMonetary
              ? withRupee(item[col.key])
              : String(item[col.key] ?? "N/A");
          }
        });

        doc.font(baseFont).fontSize(cols.length > 7 ? 7.5 : 8.5);
        const textH = doc.heightOfString(formattedValues[0], {
          width: colWidths[0] - 6,
        });
        const rowHeight = Math.max(22, textH + 10);

        if (currentY + rowHeight > pageHeight - bottomMargin) {
          doc.addPage();
          drawPageDecorations();
          currentY = topMargin + 10;
          drawHeaderRow(currentY);
          currentY += headerHeight;
        }

        if (rowIndex % 2 === 1) {
          doc.save();
          doc.rect(leftMargin, currentY, usableWidth, rowHeight).fill("#F8FAFC");
          doc.restore();
        }

        doc.font(baseFont).fillColor("#1E293B");
        let x = leftMargin;
        cols.forEach((col, i) => {
          const valStr = formattedValues[i];
          let fontSize = cols.length > 7 ? 7.5 : 8.5;
          doc.fontSize(fontSize);

          if (col.align === "right" || col.align === "center") {
            const availW = colWidths[i] - 4;
            while (doc.widthOfString(valStr) > availW && fontSize > 6.0) {
              fontSize -= 0.5;
              doc.fontSize(fontSize);
            }
          }

          doc.text(valStr, x + 2, currentY + 6, {
            width: colWidths[i] - 4,
            align: col.align || "left",
            lineBreak: col.key === "service_name",
          });
          x += colWidths[i];
        });

        doc.save();
        doc
          .moveTo(leftMargin, currentY + rowHeight)
          .lineTo(leftMargin + usableWidth, currentY + rowHeight)
          .strokeColor("#E2E8F0")
          .lineWidth(0.5)
          .stroke();
        doc.restore();

        currentY += rowHeight;
      });

      currentY += 16;
      return currentY;
    };

    currentY = renderTable(serviceItems, finalServiceCols, "Services");
    currentY = renderTable(inventoryItems, inventoryCols, "Retail");

    // === SUMMARY SECTION ===
    const summaryWidth = 240;
    const summaryX = pageWidth - rightMargin - summaryWidth;

    const estimatedSummaryHeight = 110;
    if (currentY + estimatedSummaryHeight > pageHeight - bottomMargin) {
      doc.addPage();
      drawPageDecorations();
      currentY = topMargin + 10;
    }

    let summaryY = currentY + 5;

    const addSummaryRow = (label, value, isGrandTotal = false) => {
      if (isGrandTotal) {
        summaryY += 6;
        doc.save();
        doc
          .roundedRect(summaryX, summaryY, summaryWidth, 34, 5)
          .fill("#0F172A");

        doc
          .font(boldFont)
          .fontSize(10)
          .fillColor("#FFFFFF")
          .text(label.toUpperCase(), summaryX + 12, summaryY + 11, { width: 110 });

        doc
          .font(boldFont)
          .fontSize(12)
          .fillColor("#FFFFFF")
          .text(value, summaryX + 110, summaryY + 10, {
            width: summaryWidth - 122,
            align: "right",
          });
        doc.restore();
        summaryY += 40;
      } else {
        doc.font(baseFont).fontSize(9).fillColor("#475569");
        doc.text(label, summaryX, summaryY, { width: 130 });

        doc
          .font(boldFont)
          .fontSize(9)
          .fillColor("#1E293B")
          .text(value, summaryX + 130, summaryY, {
            width: summaryWidth - 130,
            align: "right",
          });

        summaryY += 14;

        doc.save();
        doc
          .moveTo(summaryX, summaryY + 2)
          .lineTo(summaryX + summaryWidth, summaryY + 2)
          .strokeColor("#F1F5F9")
          .lineWidth(0.5)
          .stroke();
        doc.restore();

        summaryY += 5;
      }
    };

    addSummaryRow("Sub Total", withRupee(bill.sub_total));

    if (
      String(bill.discount_amount) !== "0" &&
      String(bill.discount_amount) !== "0.00"
    ) {
      addSummaryRow(
        `Discount (${bill.discount_percentage}%)`,
        `${withRupee(bill.discount_amount)}`
      );
    }
    addSummaryRow("Taxable After Discount", withRupee(bill.taxable_after_discount));
    addSummaryRow("Total Tax", withRupee(bill.total_tax));
    if (bill.bank_charges != "" && bill.bank_charges) {
      addSummaryRow("Bank Charges (2%)", withRupee(bill.bank_charges));
    }

    if (
      String(bill.shipping_charges) !== "0" &&
      String(bill.shipping_charges) !== "0.00"
    ) {
      addSummaryRow("Shipping", withRupee(bill.shipping_charges));
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
      addSummaryRow("Round Off", formattedRO);
    }

    addSummaryRow("Grand Total", `Rs. ${withRupee(bill.grand_total)}`, true);

    // === SYSTEM GENERATED NOTICE ===
    let noticeY = summaryY + 20;

    if (noticeY + 25 > pageHeight - bottomMargin) {
      doc.addPage();
      drawPageDecorations();
      noticeY = topMargin + 20;
    }

    doc
      .font(baseFont)
      .fontSize(8.5)
      .fillColor("#64748B")
      .text(
        "This is a system-generated invoice. No signature required.",
        leftMargin,
        noticeY,
        {
          width: usableWidth,
          align: "center",
        }
      );

    if (isDeletedInvoice(bill)) {
      applyDeletedWatermarkToAllPages(doc, baseFont);
    }

    // Apply Page Numbers & Bottom Footer Rule across all pages (with bottom margin set to 0 to avoid page breaks)
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + totalPages; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.font(baseFont).fontSize(8).fillColor("#94A3B8");

      const footerY = pageHeight - 25;
      doc
        .moveTo(leftMargin, footerY - 5)
        .lineTo(pageWidth - rightMargin, footerY - 5)
        .strokeColor("#F1F5F9")
        .lineWidth(0.5)
        .stroke();

      doc.text("Thank you for your business!", leftMargin, footerY, {
        width: 200,
        align: "left",
        lineBreak: false,
      });

      if (totalPages > 1) {
        doc.text(`Page ${i + 1} of ${totalPages}`, pageWidth - rightMargin - 150, footerY, {
          width: 150,
          align: "right",
          lineBreak: false,
        });
      }
      doc.restore();
    }
    doc.page.margins.bottom = oldBottomMargin;

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

    const leftMargin = 40;
    const rightMargin = 40;
    const topMargin = 40;
    const bottomMargin = 50;

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin },
      bufferPages: true,
    });

    if (fs.existsSync(fontPath)) {
      doc.registerFont("NotoSans", fontPath);
      doc.registerFont("NotoSans-Bold", fontPath);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=receipt_${receipt.receipt_id}.pdf`
    );
    doc.pipe(res);

    const baseFont = fs.existsSync(fontPath) ? "NotoSans" : "Helvetica";
    const boldFont = fs.existsSync(fontPath) ? "NotoSans-Bold" : "Helvetica-Bold";

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const usableWidth = pageWidth - leftMargin - rightMargin;

    // Draw Top Accent Stripe (Dual Line)
    const drawPageDecorations = () => {
      doc.save();
      doc.rect(0, 0, pageWidth, 5).fill("#0F172A");
      doc.rect(0, 5, pageWidth, 2).fill("#059669");
      doc.restore();
    };

    drawPageDecorations();

    // === ORGANIZATION HEADER & RECEIPT TITLE ===
    const orgName = receipt?.brand_name_text || "";
    let headerY = 24;

    // Brand / Org Title (Left)
    if (orgName) {
      doc
        .font(boldFont)
        .fontSize(19)
        .fillColor("#0F172A")
        .text(orgName, leftMargin, headerY, { width: 310, align: "left" });
    }

    // Official Receipt Badge (Top Right)
    const badgeWidth = 160;
    const badgeHeight = 24;
    const badgeX = pageWidth - rightMargin - badgeWidth;
    const badgeY = headerY;

    const isValid = receipt.is_valid;
    const statusBg = isValid ? "#ECFDF5" : "#FEF2F2";
    const statusBorder = isValid ? "#A7F3D0" : "#FCA5A5";
    const statusText = isValid ? "#047857" : "#B91C1C";

    doc.save();
    doc
      .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 5)
      .fillColor(statusBg)
      .strokeColor(statusBorder)
      .lineWidth(1)
      .fillAndStroke();

    doc
      .font(boldFont)
      .fontSize(9)
      .fillColor(statusText)
      .text("PAYMENT RECEIPT", badgeX, badgeY + 6, {
        width: badgeWidth,
        align: "center",
      });
    doc.restore();

    // Meta Details (Under Badge)
    let metaY = badgeY + badgeHeight + 8;
    doc
      .font(boldFont)
      .fontSize(9.5)
      .fillColor("#0F172A")
      .text(`Receipt No: ${receipt.receipt_id}`, leftMargin + 300, metaY, {
        width: 215,
        align: "right",
      });
    metaY += 14;
    doc
      .font(baseFont)
      .fontSize(8.5)
      .fillColor("#64748B")
      .text(`Date & Time: ${formatDate(receipt.created_at)}`, leftMargin + 300, metaY, {
        width: 215,
        align: "right",
      });
    metaY += 14;
    doc
      .font(boldFont)
      .fontSize(8.5)
      .fillColor(statusText)
      .text(`Status: ${isValid ? "PAID" : "VOID"}`, leftMargin + 300, metaY, {
        width: 215,
        align: "right",
      });

    // === CLIENT SECTION CARD WITH LEFT ACCENT ===
    let clientCardY = Math.max(doc.y + 16, 85);

    const clientName =
      [receipt.clients.first_name, receipt.clients.last_name]
        .filter(Boolean)
        .join(" ") || "N/A";

    const clientDetails = [];
    clientDetails.push({ label: "Client Name", value: clientName, isBold: true });
    if (receipt.clients.email) clientDetails.push({ label: "Email", value: receipt.clients.email });
    if (receipt.clients.phone) clientDetails.push({ label: "Mobile", value: receipt.clients.phone });
    if (receipt.clients.address) clientDetails.push({ label: "Address", value: receipt.clients.address });

    const cardHeight = 40 + clientDetails.length * 15;

    doc.save();
    doc
      .roundedRect(leftMargin, clientCardY, usableWidth, cardHeight, 6)
      .fillColor("#F8FAFC")
      .strokeColor("#E2E8F0")
      .lineWidth(1)
      .fillAndStroke();

    // Left Emerald Accent Bar
    doc
      .roundedRect(leftMargin, clientCardY, 4, cardHeight, 2)
      .fillColor("#059669");

    doc
      .font(boldFont)
      .fontSize(8)
      .fillColor("#475569")
      .text("RECEIVED WITH THANKS FROM:", leftMargin + 14, clientCardY + 10, {
        width: usableWidth - 28,
      });

    doc
      .moveTo(leftMargin + 14, clientCardY + 23)
      .lineTo(leftMargin + usableWidth - 14, clientCardY + 23)
      .strokeColor("#CBD5E1")
      .lineWidth(0.5)
      .stroke();

    let detailY = clientCardY + 28;
    clientDetails.forEach((detail) => {
      if (detail.isBold) {
        doc.font(boldFont).fontSize(9.5).fillColor("#1E293B");
        doc.text(detail.value, leftMargin + 14, detailY, { width: usableWidth - 28 });
      } else {
        doc.font(baseFont).fontSize(8.5).fillColor("#64748B");
        doc.text(`${detail.label}: `, leftMargin + 14, detailY, { continued: true });
        doc.font(baseFont).fillColor("#1E293B").text(detail.value);
      }
      detailY += 15;
    });

    doc.restore();

    // === LINE ITEMS TABLE ===
    let currentY = clientCardY + cardHeight + 22;

    const cols = [
      { label: "PARTICULARS", width: 0.80, key: "service_name" },
      { label: "QTY", width: 0.20, key: "quantity", align: "center" },
    ];

    const colWidths = cols.map((col) => Math.floor(col.width * usableWidth));
    colWidths[colWidths.length - 1] += usableWidth - colWidths.reduce((a, b) => a + b, 0);

    const headerHeight = 22;

    // Table Header
    doc.save();
    doc
      .roundedRect(leftMargin, currentY, usableWidth, headerHeight, 3)
      .fill("#0F172A");

    doc.font(boldFont).fontSize(8).fillColor("#FFFFFF");
    let x = leftMargin;
    cols.forEach((col, i) => {
      doc.text(col.label, x + 8, currentY + 6, {
        width: colWidths[i] - 16,
        align: col.align || "left",
      });
      x += colWidths[i];
    });
    doc.restore();

    currentY += headerHeight;

    // Table Rows
    doc.font(baseFont).fontSize(8.5);
    receipt.receipt_bill_line_items.forEach((item, index) => {
      const serviceName = item.service_name || item.services?.name || "Service";
      const qty = parseFloat(item.quantity);
      const qtyStr = qty.toFixed(3);

      const textH = doc.heightOfString(serviceName, { width: colWidths[0] - 16 });
      const rowHeight = Math.max(22, textH + 10);

      if (currentY + rowHeight > pageHeight - bottomMargin) {
        doc.addPage();
        drawPageDecorations();
        currentY = topMargin + 10;
      }

      if (index % 2 === 1) {
        doc.save();
        doc.rect(leftMargin, currentY, usableWidth, rowHeight).fill("#F8FAFC");
        doc.restore();
      }

      doc.fillColor("#1E293B");
      doc.text(serviceName, leftMargin + 8, currentY + 6, {
        width: colWidths[0] - 16,
        align: "left",
      });

      doc.text(qtyStr, leftMargin + colWidths[0] + 8, currentY + 6, {
        width: colWidths[1] - 16,
        align: "center",
      });

      doc.save();
      doc
        .moveTo(leftMargin, currentY + rowHeight)
        .lineTo(leftMargin + usableWidth, currentY + rowHeight)
        .strokeColor("#E2E8F0")
        .lineWidth(0.5)
        .stroke();
      doc.restore();

      currentY += rowHeight;
    });

    // === TOTAL AMOUNT CALLOUT BOX ===
    const totalBoxWidth = 230;
    const totalBoxX = pageWidth - rightMargin - totalBoxWidth;
    const totalBoxY = currentY + 16;

    doc.save();
    doc
      .roundedRect(totalBoxX, totalBoxY, totalBoxWidth, 48, 6)
      .fillColor("#F0FDF4")
      .strokeColor("#BBF7D0")
      .lineWidth(1)
      .fillAndStroke();

    doc
      .font(boldFont)
      .fontSize(8)
      .fillColor("#166534")
      .text("TOTAL AMOUNT RECEIVED", totalBoxX + 14, totalBoxY + 9, {
        width: totalBoxWidth - 28,
      });

    doc
      .font(boldFont)
      .fontSize(14)
      .fillColor("#15803D")
      .text(`Rs. ${withRupee(receipt.amount)}`, totalBoxX + 14, totalBoxY + 24, {
        width: totalBoxWidth - 28,
      });
    doc.restore();

    // === CERTIFICATION & FOOTER SECTION ===
    let footerStartY = totalBoxY + 68;

    if (footerStartY + 140 > pageHeight - bottomMargin) {
      doc.addPage();
      drawPageDecorations();
      footerStartY = topMargin + 10;
    }

    doc
      .font(baseFont)
      .fontSize(8.5)
      .fillColor("#64748B")
      .text(
        "This is to certify that the above-mentioned amount has been received in full satisfaction of the services rendered.",
        leftMargin,
        footerStartY,
        { width: usableWidth, align: "center" }
      );

    doc.text(
      "This receipt is valid without signature only if issued electronically through our official system.",
      leftMargin,
      footerStartY + 16,
      { width: usableWidth, align: "center" }
    );

    // Authorized Stamp & Signature Block
    const stampY = footerStartY + 50;
    const stampWidth = 220;
    const stampX = (pageWidth - stampWidth) / 2;

    doc
      .font(boldFont)
      .fontSize(8)
      .fillColor("#475569")
      .text("FOR & ON BEHALF OF", stampX, stampY, {
        width: stampWidth,
        align: "center",
      });

    doc
      .font(boldFont)
      .fontSize(9.5)
      .fillColor("#1E293B")
      .text(orgName, stampX, stampY + 12, {
        width: stampWidth,
        align: "center",
      });

    const lineY = stampY + 38;
    doc.save();
    doc
      .moveTo(stampX + 20, lineY)
      .lineTo(stampX + stampWidth - 20, lineY)
      .strokeColor("#CBD5E1")
      .dash(2, { space: 2 })
      .stroke();
    doc.restore();

    doc
      .font(baseFont)
      .fontSize(8.5)
      .fillColor("#64748B")
      .text("Authorized Signatory", stampX, lineY + 6, {
        width: stampWidth,
        align: "center",
      });

    const footerText = "This is a system-generated receipt. No signature required.";
    doc.fontSize(7.5).fillColor("#94A3B8").text(footerText, stampX, lineY + 20, {
      width: stampWidth,
      align: "center",
    });

    // Page Numbers & Bottom Rule (with bottom margin set to 0 to avoid page breaks)
    const oldBottomMarginReceipt = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + totalPages; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.font(baseFont).fontSize(8).fillColor("#94A3B8");

      const footerY = pageHeight - 25;
      doc
        .moveTo(leftMargin, footerY - 5)
        .lineTo(pageWidth - rightMargin, footerY - 5)
        .strokeColor("#F1F5F9")
        .lineWidth(0.5)
        .stroke();

      doc.text("Official Payment Receipt", leftMargin, footerY, {
        width: 200,
        align: "left",
        lineBreak: false,
      });

      if (totalPages > 1) {
        doc.text(`Page ${i + 1} of ${totalPages}`, pageWidth - rightMargin - 150, footerY, {
          width: 150,
          align: "right",
          lineBreak: false,
        });
      }
      doc.restore();
    }
    doc.page.margins.bottom = oldBottomMarginReceipt;

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
