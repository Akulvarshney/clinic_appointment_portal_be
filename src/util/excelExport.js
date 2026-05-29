import XLSX from "xlsx";

function sanitizeFileName(name) {
  return String(name || "export")
    .trim()
    .replace(/[^\w.:-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "export";
}

function normalizeCellValue(value) {
  if (value === undefined || value === null) return "";
  return value;
}

export const sendExcelDownload = (
  res,
  { filename, sheetName = "Sheet1", columns, rows },
) => {
  const worksheetRows = rows.map((row) =>
    Object.fromEntries(
      columns.map((column) => [
        column.header,
        normalizeCellValue(
          typeof column.value === "function"
            ? column.value(row)
            : row[column.key],
        ),
      ]),
    ),
  );

  const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
  worksheet["!cols"] = columns.map((column) => ({
    wch: column.width || Math.max(String(column.header).length + 2, 14),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  });

  const safeFilename = sanitizeFileName(filename);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeFilename}.xlsx"`,
  );
  res.send(buffer);
};
