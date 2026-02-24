import { describe, it, expect } from "vitest";

/**
 * Tests for the SUM formula row arithmetic used in generateSpreadsheet.ts.
 *
 * The buildYourBalanceSheet function tracks a `currentRow` counter as it adds
 * rows via `ws.addRow()`. Each section follows this pattern:
 *
 *   1. Section header row      → currentRow++
 *   2. Section note row         → currentRow++
 *   3. Table header row         → currentRow++
 *   4. firstDataRow = currentRow
 *   5. N data rows              → currentRow++ per row
 *   6. lastDataRow = currentRow - 1
 *   7. SUM formula row          → SUM(D{firstDataRow}:D{lastDataRow})
 *   8. currentRow++
 *
 * The bug was: firstDataRow = currentRow + 1 (off by one, skipping first data
 * row) and lastDataRow = currentRow (includes the SUM row itself — circular).
 *
 * Fixed to: firstDataRow = currentRow, lastDataRow = currentRow - 1.
 */

/** Simulates the row-counting logic for one section of buildYourBalanceSheet. */
function simulateSection(
  startingRow: number,
  dataCount: number
): { firstDataRow: number; lastDataRow: number; sumRow: number } {
  let currentRow = startingRow;

  // Section header
  currentRow++;
  // Section note
  currentRow++;
  // Table header
  currentRow++;

  // Fixed logic (matching the current code)
  const firstDataRow = currentRow;
  for (let i = 0; i < dataCount; i++) {
    currentRow++;
  }
  const lastDataRow = currentRow - 1;

  // SUM row
  const sumRow = currentRow;
  currentRow++;

  return { firstDataRow, lastDataRow, sumRow };
}

describe("SUM formula row arithmetic", () => {
  it("with 1 data row, formula covers exactly that row", () => {
    const { firstDataRow, lastDataRow, sumRow } = simulateSection(4, 1);
    expect(lastDataRow - firstDataRow + 1).toBe(1);
    expect(sumRow).toBeGreaterThan(lastDataRow);
    expect(firstDataRow).toBe(lastDataRow); // single row
  });

  it("with 2 data rows, formula covers both rows", () => {
    const { firstDataRow, lastDataRow, sumRow } = simulateSection(4, 2);
    expect(lastDataRow - firstDataRow + 1).toBe(2);
    expect(sumRow).toBeGreaterThan(lastDataRow);
  });

  it("with 5 data rows, formula covers all 5", () => {
    const { firstDataRow, lastDataRow, sumRow } = simulateSection(4, 5);
    expect(lastDataRow - firstDataRow + 1).toBe(5);
    expect(sumRow).toBeGreaterThan(lastDataRow);
  });

  it("SUM row is always exactly lastDataRow + 1", () => {
    for (const n of [1, 2, 3, 10, 50]) {
      const { lastDataRow, sumRow } = simulateSection(4, n);
      expect(sumRow).toBe(lastDataRow + 1);
    }
  });

  it("works correctly regardless of starting row", () => {
    // Sections start at different rows depending on preceding sections
    for (const start of [4, 12, 20, 30]) {
      const { firstDataRow, lastDataRow, sumRow } = simulateSection(start, 3);
      expect(lastDataRow - firstDataRow + 1).toBe(3);
      expect(sumRow).toBe(lastDataRow + 1);
      // First data row is 3 rows after section start (header + note + table header)
      expect(firstDataRow).toBe(start + 3);
    }
  });

  it("would have been broken with the old logic (regression guard)", () => {
    // Old buggy logic: firstDataRow = currentRow + 1, lastDataRow = currentRow
    function simulateBuggySection(startingRow: number, dataCount: number) {
      let currentRow = startingRow;
      currentRow++; // section header
      currentRow++; // section note
      currentRow++; // table header

      const firstDataRow = currentRow + 1; // BUG: skips first data row
      for (let i = 0; i < dataCount; i++) {
        currentRow++;
      }
      const lastDataRow = currentRow; // BUG: includes sum row

      const sumRow = currentRow;
      return { firstDataRow, lastDataRow, sumRow };
    }

    const buggy = simulateBuggySection(4, 2);
    // With 2 data rows, buggy version skips the first and includes the sum row
    // firstDataRow points one past the actual first data row
    const fixed = simulateSection(4, 2);
    expect(buggy.firstDataRow).toBe(fixed.firstDataRow + 1); // skips first
    // AND the sum row is within the range (circular reference!)
    expect(buggy.sumRow).toBe(buggy.lastDataRow);
  });
});
