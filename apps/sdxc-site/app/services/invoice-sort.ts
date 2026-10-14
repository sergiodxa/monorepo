/**
 * Orders a table's rows from the sort key its column links carry.
 *
 * The table sorts through links rather than script: a header names a URL, the request
 * comes back ordered, and the page reads which column is active from the query it was
 * asked for. This holds that reading, so a preview can show the mechanism working.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A row this module can order, which is any row carrying the four sortable fields. */
export interface SortableInvoice {
	id: string;
	customer: string;
	issued: string;
	total: number;
}

/** The columns a header offers to sort by. */
export type SortKey = "id" | "customer" | "issued" | "total";

/** Which way a column is ordered, in the words `aria-sort` accepts. */
export type SortDirection = "ascending" | "descending";

/** What a request asked for, once its query has been read. */
export interface SortRequest {
	key: SortKey;
	direction: SortDirection;
}

const KEYS = new Set<string>(["id", "customer", "issued", "total"]);

/** The column a row is ordered by when the query names none. */
const DEFAULT: SortRequest = { key: "issued", direction: "descending" };

/**
 * Reads the sort a query string asked for.
 *
 * @param search - The query as it arrived, with or without its leading `?`.
 * @returns The column and direction to order by, falling back to the default.
 *
 * @example readSort("?sort=customer&dir=desc")
 * @example { key: "customer", direction: "descending" }
 */
export function readSort(search: string): SortRequest {
	let query = new URLSearchParams(search);
	let key = query.get("sort") ?? "";
	if (!KEYS.has(key)) return DEFAULT;

	return {
		key: key as SortKey,
		direction: query.get("dir") === "desc" ? "descending" : "ascending",
	};
}

/**
 * The URL a header links to, which asks for its own column and flips the direction when
 * that column is already the active one.
 *
 * @param key - The column the header sorts by.
 * @param active - The sort the page is currently showing.
 * @returns A query string for the same page, ordered by `key`.
 */
export function sortHref(key: SortKey, active: SortRequest): string {
	let flip = active.key === key && active.direction === "ascending";
	return flip ? `?sort=${key}&dir=desc` : `?sort=${key}`;
}

/**
 * Orders rows by the sort asked for, leaving the rows given untouched.
 *
 * @param rows - The rows to order.
 * @param sort - The column and direction to order by.
 * @returns A new array in the requested order.
 */
export function sortInvoices<Row extends SortableInvoice>(
	rows: readonly Row[],
	sort: SortRequest,
): Row[] {
	let ordered = [...rows].sort((left, right) => {
		if (sort.key === "total") return left.total - right.total;
		return left[sort.key].localeCompare(right[sort.key]);
	});

	return sort.direction === "descending" ? ordered.reverse() : ordered;
}
