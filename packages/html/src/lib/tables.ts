/**
 * Reads a table as rows of cells, telling header rows from body rows so row and
 * column addressing counts the rows a reader would count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Tags that carry a row's cells. */
const CELL_TAGS = new Set(["td", "th"]);

/**
 * Lists the table's own rows in document order, leaving a nested table's rows to
 * that table.
 *
 * @param table - The table to read
 * @param includeHeader - Whether header rows count toward the row numbers
 */
export function tableRows(table: Element, includeHeader: boolean): Element[] {
	let rows = Array.from(table.querySelectorAll("tr")).filter(
		(row) => row.closest("table") === table,
	);
	if (includeHeader) return rows;
	return rows.filter((row) => !isHeaderRow(row));
}

/** Lists the cells a row carries, header cells included, in document order. */
export function rowCells(row: Element): Element[] {
	return Array.from(row.children).filter((cell) => CELL_TAGS.has(cell.localName.toLowerCase()));
}

/**
 * Recognizes a row that labels the table rather than holding its data, either by
 * sitting in the head or by carrying header cells alone.
 */
function isHeaderRow(row: Element): boolean {
	if (row.closest("thead")) return true;
	let cells = rowCells(row);
	if (cells.length === 0) return false;
	return cells.every((cell) => cell.localName.toLowerCase() === "th");
}
