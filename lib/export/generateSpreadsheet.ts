import ExcelJS from "exceljs";
import type { GroupExportData } from "./buildExportData";

/** Converts cents to dollars for display in spreadsheet cells. */
function centsToNum(cents: number): number {
  return cents / 100;
}

/** Standard dollar format string for Excel. */
const DOLLAR_FMT = '$#,##0.00';

/**
 * Generates a formatted .xlsx workbook from pre-built export data.
 * Returns the workbook as a Buffer ready to be sent as a response body.
 */
export async function generateSpreadsheet(data: GroupExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Aviary";
  workbook.created = new Date();

  buildAllExpensesSheet(workbook, data);
  buildYourBalanceSheet(workbook, data);
  buildAllSplitsSheet(workbook, data);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ---------------------------------------------------------------------------
// Sheet 1: All Expenses
// ---------------------------------------------------------------------------
function buildAllExpensesSheet(workbook: ExcelJS.Workbook, data: GroupExportData) {
  const ws = workbook.addWorksheet("All Expenses");

  // Title
  ws.addRow([`${data.groupName} — All Expenses`]);
  styleTitle(ws, 1);
  ws.addRow([`Exported for ${data.exportedFor} on ${data.exportDate}`]);
  styleSubtitle(ws, 2);
  ws.addRow([]);

  // Header
  const headerRow = ws.addRow(["Date", "Description", "Type", "Paid By", "Total", "Your Share"]);
  styleHeader(headerRow);

  // Data rows
  for (const row of data.allExpenses) {
    const r = ws.addRow([
      row.date,
      row.description,
      row.type,
      row.paidBy,
      centsToNum(row.totalCents),
      row.yourShareCents !== null ? centsToNum(row.yourShareCents) : "—",
    ]);
    formatDollarCell(r.getCell(5));
    if (row.yourShareCents !== null) formatDollarCell(r.getCell(6));
  }

  // Auto-width columns
  autoWidth(ws, [12, 30, 10, 18, 12, 12]);
}

// ---------------------------------------------------------------------------
// Sheet 2: Your Balance
// ---------------------------------------------------------------------------
function buildYourBalanceSheet(workbook: ExcelJS.Workbook, data: GroupExportData) {
  const ws = workbook.addWorksheet("Your Balance");

  // Title
  ws.addRow([`${data.groupName} — Balance Breakdown for ${data.exportedFor}`]);
  styleTitle(ws, 1);
  ws.addRow([`Exported on ${data.exportDate}`]);
  styleSubtitle(ws, 2);
  ws.addRow([]);

  // ---- Section: What you owe ----
  let currentRow = 4;

  ws.addRow(["EXPENSES YOU OWE ON"]);
  styleSectionHeader(ws, currentRow);
  currentRow++;

  ws.addRow(["(These are expenses where someone else paid and you have a share)"]);
  styleSectionNote(ws, currentRow);
  currentRow++;

  if (data.youOwe.length > 0) {
    const oweHeaderRow = ws.addRow(["Date", "Description", "Paid By", "Your Share"]);
    styleHeader(oweHeaderRow);
    currentRow++;

    const firstDataRow = currentRow;
    for (const row of data.youOwe) {
      const r = ws.addRow([row.date, row.description, row.paidBy, centsToNum(row.yourShareCents)]);
      formatDollarCell(r.getCell(4));
      currentRow++;
    }
    const lastDataRow = currentRow - 1;

    // SUM formula
    const sumRow = ws.addRow(["", "", "Total you owe:", { formula: `SUM(D${firstDataRow}:D${lastDataRow})` }]);
    styleTotalRow(sumRow, 3, 4);
    formatDollarCell(sumRow.getCell(4));
    currentRow++;
  } else {
    ws.addRow(["You don't owe anyone anything in this group."]);
    currentRow++;
  }

  ws.addRow([]);
  currentRow++;

  // ---- Section: What you're owed ----
  ws.addRow(["EXPENSES OTHERS OWE YOU"]);
  styleSectionHeader(ws, currentRow);
  currentRow++;

  ws.addRow(["(These are expenses where you paid and others have shares)"]);
  styleSectionNote(ws, currentRow);
  currentRow++;

  if (data.owedToYou.length > 0) {
    const owedHeaderRow = ws.addRow(["Date", "Description", "Who Owes", "Their Share"]);
    styleHeader(owedHeaderRow);
    currentRow++;

    const firstDataRow = currentRow;
    for (const row of data.owedToYou) {
      const r = ws.addRow([row.date, row.description, row.who, centsToNum(row.theirShareCents)]);
      formatDollarCell(r.getCell(4));
      currentRow++;
    }
    const lastDataRow = currentRow - 1;

    const sumRow = ws.addRow(["", "", "Total owed to you:", { formula: `SUM(D${firstDataRow}:D${lastDataRow})` }]);
    styleTotalRow(sumRow, 3, 4);
    formatDollarCell(sumRow.getCell(4));
    currentRow++;
  } else {
    ws.addRow(["Nobody owes you anything in this group."]);
    currentRow++;
  }

  ws.addRow([]);
  currentRow++;

  // ---- Section: Payments you made ----
  ws.addRow(["PAYMENTS YOU MADE"]);
  styleSectionHeader(ws, currentRow);
  currentRow++;

  ws.addRow(["(Money you sent to others outside the app — Venmo, cash, etc.)"]);
  styleSectionNote(ws, currentRow);
  currentRow++;

  if (data.paymentsMade.length > 0) {
    const pmHeaderRow = ws.addRow(["Date", "To", "", "Amount"]);
    styleHeader(pmHeaderRow);
    currentRow++;

    const firstDataRow = currentRow;
    for (const row of data.paymentsMade) {
      const r = ws.addRow([row.date, row.otherParty, "", centsToNum(row.amountCents)]);
      formatDollarCell(r.getCell(4));
      currentRow++;
    }
    const lastDataRow = currentRow - 1;

    const sumRow = ws.addRow(["", "", "Total payments made:", { formula: `SUM(D${firstDataRow}:D${lastDataRow})` }]);
    styleTotalRow(sumRow, 3, 4);
    formatDollarCell(sumRow.getCell(4));
    currentRow++;
  } else {
    ws.addRow(["You haven't made any payments in this group."]);
    currentRow++;
  }

  ws.addRow([]);
  currentRow++;

  // ---- Section: Payments you received ----
  ws.addRow(["PAYMENTS YOU RECEIVED"]);
  styleSectionHeader(ws, currentRow);
  currentRow++;

  ws.addRow(["(Money others sent to you outside the app)"]);
  styleSectionNote(ws, currentRow);
  currentRow++;

  if (data.paymentsReceived.length > 0) {
    const prHeaderRow = ws.addRow(["Date", "From", "", "Amount"]);
    styleHeader(prHeaderRow);
    currentRow++;

    const firstDataRow = currentRow;
    for (const row of data.paymentsReceived) {
      const r = ws.addRow([row.date, row.otherParty, "", centsToNum(row.amountCents)]);
      formatDollarCell(r.getCell(4));
      currentRow++;
    }
    const lastDataRow = currentRow - 1;

    const sumRow = ws.addRow(["", "", "Total payments received:", { formula: `SUM(D${firstDataRow}:D${lastDataRow})` }]);
    styleTotalRow(sumRow, 3, 4);
    formatDollarCell(sumRow.getCell(4));
    currentRow++;
  } else {
    ws.addRow(["You haven't received any payments in this group."]);
    currentRow++;
  }

  ws.addRow([]);
  ws.addRow([]);
  currentRow += 2;

  // ---- Section: Net Balance Summary ----
  ws.addRow(["NET BALANCE SUMMARY"]);
  styleSectionHeader(ws, currentRow);
  currentRow++;

  ws.addRow(["(How the numbers above combine to determine your balance)"]);
  styleSectionNote(ws, currentRow);
  currentRow++;

  const summaryItems: Array<[string, number]> = [
    ["Total others owe you (from expenses):", data.totalOwedToYouCents],
    ["Total you owe others (from expenses):", data.totalYouOweCents],
    ["Total payments you made:", data.totalPaymentsMadeCents],
    ["Total payments you received:", data.totalPaymentsReceivedCents],
  ];

  for (const [label, cents] of summaryItems) {
    const r = ws.addRow(["", "", label, centsToNum(cents)]);
    formatDollarCell(r.getCell(4));
    currentRow++;
  }

  // Net balance row
  const netRow = ws.addRow(["", "", "YOUR NET BALANCE:", centsToNum(data.netBalanceCents)]);
  styleTotalRow(netRow, 3, 4);
  formatDollarCell(netRow.getCell(4));
  if (data.netBalanceCents > 0) {
    netRow.getCell(4).font = { ...netRow.getCell(4).font, color: { argb: "FF16A34A" } }; // green
  } else if (data.netBalanceCents < 0) {
    netRow.getCell(4).font = { ...netRow.getCell(4).font, color: { argb: "FFDC2626" } }; // red
  }
  currentRow++;

  ws.addRow([]);
  ws.addRow(["", "", "Positive = others owe you. Negative = you owe others."]);
  currentRow += 2;

  ws.addRow([]);
  currentRow++;

  // ---- Section: Simplified Debts ----
  ws.addRow(["SIMPLIFIED DEBTS (what the app shows)"]);
  styleSectionHeader(ws, currentRow);
  currentRow++;

  ws.addRow(["(The algorithm minimizes the number of payments needed to settle up)"]);
  styleSectionNote(ws, currentRow);
  currentRow++;

  if (data.simplifiedDebts.length > 0) {
    const sdHeaderRow = ws.addRow(["", "From", "To", "Amount"]);
    styleHeader(sdHeaderRow);
    currentRow++;

    for (const row of data.simplifiedDebts) {
      const r = ws.addRow(["", row.from, row.to, centsToNum(row.amountCents)]);
      formatDollarCell(r.getCell(4));
      currentRow++;
    }
  } else {
    ws.addRow(["Everyone is settled up!"]);
    currentRow++;
  }

  autoWidth(ws, [12, 30, 28, 14]);
}

// ---------------------------------------------------------------------------
// Sheet 3: All Splits
// ---------------------------------------------------------------------------
function buildAllSplitsSheet(workbook: ExcelJS.Workbook, data: GroupExportData) {
  const ws = workbook.addWorksheet("All Splits");

  // Title
  ws.addRow([`${data.groupName} — Every Split Record`]);
  styleTitle(ws, 1);
  ws.addRow([`Exported for ${data.exportedFor} on ${data.exportDate}`]);
  styleSubtitle(ws, 2);
  ws.addRow([]);

  // Header
  const headerRow = ws.addRow(["Date", "Description", "Type", "Paid By", "Participant", "Split Amount"]);
  styleHeader(headerRow);

  for (const row of data.allSplits) {
    const r = ws.addRow([
      row.date,
      row.description,
      row.type,
      row.paidBy,
      row.participant,
      centsToNum(row.splitAmountCents),
    ]);
    formatDollarCell(r.getCell(6));
  }

  autoWidth(ws, [12, 30, 10, 18, 18, 14]);
}

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------
function styleTitle(ws: ExcelJS.Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);
  row.font = { size: 14, bold: true };
}

function styleSubtitle(ws: ExcelJS.Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);
  row.font = { size: 10, italic: true, color: { argb: "FF6B7280" } };
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, size: 10 };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
}

function styleSectionHeader(ws: ExcelJS.Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);
  row.font = { bold: true, size: 11 };
}

function styleSectionNote(ws: ExcelJS.Worksheet, rowNumber: number) {
  const row = ws.getRow(rowNumber);
  row.font = { size: 9, italic: true, color: { argb: "FF9CA3AF" } };
}

function styleTotalRow(row: ExcelJS.Row, labelCol: number, valueCol: number) {
  row.getCell(labelCol).font = { bold: true, size: 10 };
  row.getCell(valueCol).font = { bold: true, size: 10 };
  row.getCell(valueCol).border = {
    top: { style: "thin", color: { argb: "FF9CA3AF" } },
  };
}

function formatDollarCell(cell: ExcelJS.Cell) {
  cell.numFmt = DOLLAR_FMT;
}

function autoWidth(ws: ExcelJS.Worksheet, minWidths: number[]) {
  for (let i = 0; i < minWidths.length; i++) {
    const col = ws.getColumn(i + 1);
    col.width = minWidths[i]!;
  }
}
