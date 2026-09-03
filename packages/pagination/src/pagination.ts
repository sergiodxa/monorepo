/**
 * The `Pagination` value object and the two query strategies that produce pages.
 *
 * The class holds every piece of page arithmetic a list or an API needs, clamped
 * once in the constructor so no derived value can disagree with the page it came
 * from. The static strategies add paging to a query the caller already composed,
 * and return a `Result`, so a database failure surfaces as a value the caller checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { Predicate } from "remix/data-table";

import { failure, isFailure, success } from "@sdxc/result";

import type { CursorDirection } from "./cursor.js";
import type { OrderByTuple, OrderDirection, SeekKey } from "./keyset.js";

import { decodeCursor, encodeCursor } from "./cursor.js";
import { InvalidCursorError, PaginationError, QueryFailedError } from "./errors.js";
import {
	buildSeekPredicate,
	readOrderingValue,
	reverseOrdering,
	validateOrdering,
	zipSeekKeys,
} from "./keyset.js";

/** Page numbers shown either side of the current page when `series()` is called without one. */
const DEFAULT_SERIES_WINDOW = 1;

/** Numbers the requested page, page size, and total row count are built from. */
export interface PaginationInit {
	/** Requested page, 1-based; clamped into range by the constructor. */
	page: number;
	/** Rows per page; coerced to at least 1. */
	perPage: number;
	/** Total rows matching the query, across every page. */
	total: number;
}

/**
 * The plain shape `toJSON()` produces, and therefore what `JSON.stringify()` emits.
 *
 * Useful as the prop type for a hydrated pager, which receives these numbers rather
 * than an instance.
 */
export interface PaginationJSON {
	/** Resolved page, after clamping. */
	page: number;
	/** Rows per page. */
	perPage: number;
	/** Total rows across every page. */
	total: number;
	/** Number of pages, never below 1. */
	pages: number;
	/** Rows to skip to reach this page. */
	offset: number;
	/** Rows to take for this page. */
	limit: number;
	/** 1-based index of this page's first row, or 0 when there are no rows. */
	from: number;
	/** 1-based index of this page's last row, or 0 when there are no rows. */
	to: number;
	/** Whether a page precedes this one. */
	hasPrev: boolean;
	/** Whether a page follows this one. */
	hasNext: boolean;
	/** Previous page number, or `null` on the first page. */
	prev: number | null;
	/** Next page number, or `null` on the last page. */
	next: number | null;
}

/**
 * One entry in a rendered pager: either a page number or an elision marker.
 *
 * A discriminated union so a pager component switches on `type` and reads
 * properties, with no arithmetic and no comparison back to the current page.
 */
export type PageSeriesItem = { type: "page"; page: number; current: boolean } | { type: "gap" };

/** The full pager range, in render order. */
export type PageSeries = PageSeriesItem[];

/** Caller's choice of how wide the page-number window around the current page is. */
export interface PageSeriesOptions {
	/**
	 * Page numbers shown either side of the current page, default `1`.
	 *
	 * The first and last pages are always present regardless of the window.
	 */
	window?: number;
}

/** An offset-paged result: the rows, plus the arithmetic they were selected with. */
export interface Page<T> {
	/** Rows for this page, in the query's own order. */
	items: T[];
	/** Arithmetic for this page, including the clamped page number and the total. */
	pagination: Pagination;
}

/** The two cursors a keyset page advertises, `null` where no such page exists. */
export interface KeysetCursors {
	/** Cursor for the following page, or `null` when this is the newest page. */
	next: string | null;
	/** Cursor for the preceding page, or `null` when this is the oldest page. */
	prev: string | null;
}

/** A keyset-paged result: the rows, plus the cursors that walk away from them. */
export interface KeysetPage<T> {
	/** Rows for this page, always in the requested order even when paging backward. */
	items: T[];
	/** Opaque cursors for the neighbouring pages. */
	cursors: KeysetCursors;
}

/**
 * The part of a `remix/data-table` query `byOffset()` uses.
 *
 * A structural type, independent of the builder's generic parameters, so any
 * bound query satisfies it directly.
 */
export interface OffsetQuery<Row> {
	/** Counts rows matching the composed predicate, ignoring any limit or offset. */
	count(): Promise<number>;
	/** Returns a new query taking at most `value` rows. */
	limit(value: number): OffsetQuery<Row>;
	/** Returns a new query skipping `value` rows. */
	offset(value: number): OffsetQuery<Row>;
	/** Executes the query and resolves the rows. */
	all(): Promise<Row[]>;
}

/** How to page a query by offset. */
export interface OffsetOptions {
	/** Requested page, 1-based; clamped into range against the total. */
	page: number;
	/** Rows per page. */
	perPage: number;
	/**
	 * A total that is already known, which skips the count query.
	 *
	 * Offset paging otherwise runs two queries per page, and on a large table the
	 * count is the expensive one.
	 */
	total?: number;
}

/**
 * The part of a `remix/data-table` query `byKeyset()` uses.
 *
 * `WhereArg` and `ColumnArg` are inferred from the query handed in, so the seek
 * predicate and ordering apply to a builder whose columns are a narrow literal union.
 */
export interface KeysetQuery<Row, WhereArg = Predicate, ColumnArg = string> {
	/** Returns a new query with an additional predicate. */
	where(input: WhereArg): KeysetQuery<Row, WhereArg, ColumnArg>;
	/** Returns a new query with an additional sort key appended. */
	orderBy(column: ColumnArg, direction: OrderDirection): KeysetQuery<Row, WhereArg, ColumnArg>;
	/** Returns a new query taking at most `value` rows. */
	limit(value: number): KeysetQuery<Row, WhereArg, ColumnArg>;
	/** Executes the query and resolves the rows. */
	all(): Promise<Row[]>;
}

/** How to page a query by keyset. */
export interface KeysetOptions {
	/**
	 * Sort keys, most significant first; the last one is the tiebreaker.
	 *
	 * The strategy owns the ordering, because it needs the sort keys both to build
	 * the seek predicate and to encode the cursor. Do not order the query yourself.
	 */
	orderBy: readonly OrderByTuple[];
	/**
	 * Declares that a one-column ordering is already unique, such as a primary key.
	 *
	 * Without it a single sort key is refused, since rows sharing a sort value are
	 * skipped or repeated across pages.
	 */
	unique?: boolean;
	/** Seek forward from this cursor. Mutually exclusive with `before` and `cursor`. */
	after?: string | null;
	/** Seek backward from this cursor. Mutually exclusive with `after` and `cursor`. */
	before?: string | null;
	/**
	 * Seek in whichever direction the cursor was minted for.
	 *
	 * This is what makes a single `cursor` query parameter enough to follow both the
	 * `next` and the `prev` link, since the direction rides inside the opaque value.
	 */
	cursor?: string | null;
	/** Rows per page; one extra row is read internally to detect a following page. */
	limit: number;
}

/**
 * Coerces an untrusted number into a whole number at or above `minimum`.
 *
 * Page parameters reach the constructor from query strings and stored values, so
 * `NaN`, fractions, and negatives are all normalized to a value at or above `minimum`.
 */
function toWholeNumber(value: number, minimum: number): number {
	if (!Number.isFinite(value)) return minimum;
	return Math.max(minimum, Math.trunc(value));
}

/**
 * Page arithmetic for one page of one query, immutable once constructed.
 *
 * Every value beyond the three inputs is a getter, computed on read, so a
 * controller needing only `offset` and `limit` never computes a page series.
 *
 * @example
 * let pagination = new Pagination({ page: 3, perPage: 25, total: 892 });
 * pagination.offset; // 50
 */
export class Pagination {
	/** Clamped page number. */
	#page: number;
	/** Rows per page, at least 1. */
	#perPage: number;
	/** Total rows, at least 0. */
	#total: number;
	/** Page count, at least 1, computed once because clamping depends on it. */
	#pages: number;

	/**
	 * Builds the arithmetic for one page, clamping the requested page into range.
	 *
	 * This is the one place clamping happens, so a request for page 500 of 36
	 * resolves to page 36 and every derived value agrees with that.
	 *
	 * @param init Requested page, page size, and total row count.
	 * @example
	 * new Pagination({ page: 500, perPage: 25, total: 892 }).page; // 36
	 */
	constructor(init: PaginationInit) {
		this.#perPage = toWholeNumber(init.perPage, 1);
		this.#total = toWholeNumber(init.total, 0);
		this.#pages = Math.max(1, Math.ceil(this.#total / this.#perPage));
		this.#page = Math.min(this.#pages, toWholeNumber(init.page, 1));

		Object.freeze(this);
	}

	/** Resolved page number, 1-based, always within `1..pages`. */
	get page(): number {
		return this.#page;
	}

	/** Rows per page. */
	get perPage(): number {
		return this.#perPage;
	}

	/** Total rows matching the query, across every page. */
	get total(): number {
		return this.#total;
	}

	/** Number of pages; 1 even when there are no rows, so `page` is always valid. */
	get pages(): number {
		return this.#pages;
	}

	/** Rows to skip to reach this page. */
	get offset(): number {
		return (this.#page - 1) * this.#perPage;
	}

	/** Rows to take for this page; the same as `perPage`, named for the query builder. */
	get limit(): number {
		return this.#perPage;
	}

	/** 1-based index of this page's first row, or 0 when there are no rows at all. */
	get from(): number {
		if (this.#total === 0) return 0;
		return this.offset + 1;
	}

	/** 1-based index of this page's last row; short of a full page on the last one. */
	get to(): number {
		if (this.#total === 0) return 0;
		return Math.min(this.offset + this.#perPage, this.#total);
	}

	/** Whether a page precedes this one. */
	get hasPrev(): boolean {
		return this.#page > 1;
	}

	/** Whether a page follows this one. */
	get hasNext(): boolean {
		return this.#page < this.#pages;
	}

	/** Previous page number, or `null` on the first page. */
	get prev(): number | null {
		return this.hasPrev ? this.#page - 1 : null;
	}

	/** Next page number, or `null` on the last page. */
	get next(): number | null {
		return this.hasNext ? this.#page + 1 : null;
	}

	/**
	 * Builds the pager range, with gap markers only where page numbers are elided,
	 * so a marker never sits between two consecutive numbers. Takes `window` as an
	 * argument, so a caller wanting a different one passes it directly here.
	 *
	 * @param options Window size; defaults to one page either side.
	 * @returns The range in render order.
	 * @example
	 * new Pagination({ page: 3, perPage: 25, total: 892 }).series({ window: 1 });
	 */
	series(options?: PageSeriesOptions): PageSeries {
		let window = toWholeNumber(options?.window ?? DEFAULT_SERIES_WINDOW, 0);
		let start = Math.max(1, this.#page - window);
		let end = Math.min(this.#pages, this.#page + window);
		let items: PageSeries = [];

		if (start > 1) {
			items.push(this.#pageItem(1));
			if (start > 2) items.push({ type: "gap" });
		}

		for (let page = start; page <= end; page++) items.push(this.#pageItem(page));

		if (end < this.#pages) {
			if (end < this.#pages - 1) items.push({ type: "gap" });
			items.push(this.#pageItem(this.#pages));
		}

		return items;
	}

	/**
	 * Returns the plain shape, which `JSON.stringify()` calls automatically.
	 *
	 * Without it an instance serializes as `{}`, because every derived value lives on
	 * the prototype as a getter and neither a spread nor `Object.keys()` sees it.
	 *
	 * @returns Every value on the instance, as own properties.
	 * @example
	 * JSON.parse(JSON.stringify(pagination)).pages; // 36
	 */
	toJSON(): PaginationJSON {
		return {
			page: this.page,
			perPage: this.perPage,
			total: this.total,
			pages: this.pages,
			offset: this.offset,
			limit: this.limit,
			from: this.from,
			to: this.to,
			hasPrev: this.hasPrev,
			hasNext: this.hasNext,
			prev: this.prev,
			next: this.next,
		};
	}

	/** Builds one page entry, flagging it when it is the page being rendered. */
	#pageItem(page: number): PageSeriesItem {
		return { type: "page", page, current: page === this.#page };
	}

	/**
	 * Pages a composed query by offset, executing it twice: once to count, once to
	 * fetch — safe since the builder's chaining returns new query values instead of
	 * mutating in place. Pass `total` when already known to skip the count query.
	 *
	 * @param query A bound query from `db.query(table)`, already carrying joins, predicates, and ordering.
	 * @param options Requested page, page size, and optionally a known total.
	 * @returns The rows and their arithmetic, or `QueryFailedError` when the database refused.
	 * @example
	 * let page = await Pagination.byOffset(db.query(monitors).where({ team_id }), { page: 1, perPage: 25 });
	 */
	static async byOffset<Row>(
		query: OffsetQuery<Row>,
		options: OffsetOptions,
	): Promise<Result<Page<Row>, PaginationError>> {
		try {
			let total = options.total ?? (await query.count());
			let pagination = new Pagination({ page: options.page, perPage: options.perPage, total });
			let items = await query.limit(pagination.limit).offset(pagination.offset).all();

			return success({ items, pagination });
		} catch (error) {
			return failure(new QueryFailedError(error));
		}
	}

	/**
	 * Pages a composed query by keyset, seeking from an opaque cursor. Owns the
	 * ordering, since the sort keys build both the seek predicate and the cursor;
	 * paging backward reverses the query and the rows so pages read in order.
	 *
	 * @param query A bound query from `db.query(table)`, carrying joins and predicates but no ordering.
	 * @param options Ordering, page size, and at most one of `after`, `before`, or `cursor`.
	 * @returns The rows and the cursors around them, or a `PaginationError` for a bad ordering, a bad cursor, or a failed query.
	 * @example
	 * await Pagination.byKeyset(db.query(pings), { orderBy: [["created_at", "desc"], ["id", "desc"]], limit: 50 });
	 */
	static async byKeyset<Row, WhereArg, ColumnArg>(
		query: KeysetQuery<Row, WhereArg, ColumnArg>,
		options: KeysetOptions,
	): Promise<Result<KeysetPage<Row>, PaginationError>> {
		let ordering = validateOrdering(options.orderBy, options.unique ?? false);
		if (isFailure(ordering)) return ordering;

		let seek = resolveSeek(options);
		if (isFailure(seek)) return seek;

		let orderBy = ordering.data;
		let columns = orderBy.map(([column]) => column);
		let limit = toWholeNumber(options.limit, 1);
		let backward = seek.data.direction === "before";

		let keys: SeekKey[] | null = null;
		if (seek.data.cursor !== null) {
			let decoded = decodeCursor(seek.data.cursor);
			if (isFailure(decoded)) return decoded;

			let zipped = zipSeekKeys(orderBy, decoded.data.columns, decoded.data.values);
			if (isFailure(zipped)) return zipped;

			keys = zipped.data;
		}

		let rows: Row[];
		try {
			let seeked =
				keys === null
					? query
					: query.where(buildSeekPredicate(keys, seek.data.direction) as WhereArg);
			let traversal = backward ? reverseOrdering(orderBy) : orderBy;

			for (let [column, direction] of traversal) {
				seeked = seeked.orderBy(column as ColumnArg, direction);
			}

			rows = await seeked.limit(limit + 1).all();
		} catch (error) {
			return failure(new QueryFailedError(error));
		}

		let hasMore = rows.length > limit;
		let items = hasMore ? rows.slice(0, limit) : rows;
		if (backward) items.reverse();

		let hasNext = backward ? true : hasMore;
		let hasPrev = backward ? hasMore : seek.data.cursor !== null;

		let cursors = buildCursors(items, columns, { hasNext, hasPrev });
		if (isFailure(cursors)) return cursors;

		return success({ items, cursors: cursors.data });
	}
}

/** The single cursor and direction `byKeyset()` will page with. */
interface ResolvedSeek {
	/** Cursor to seek from, or `null` for the first page. */
	cursor: string | null;
	/** Direction to seek in; forward when no cursor was given. */
	direction: CursorDirection;
}

/**
 * Reduces `after`, `before`, and `cursor` to one cursor and one direction.
 *
 * Supplying more than one fails clearly, since the two would page in opposite
 * directions and the caller cannot tell which won.
 */
function resolveSeek(options: KeysetOptions): Result<ResolvedSeek, InvalidCursorError> {
	let after = emptyToNull(options.after);
	let before = emptyToNull(options.before);
	let ambient = emptyToNull(options.cursor);

	let supplied = [after, before, ambient].filter((value) => value !== null);
	if (supplied.length > 1) {
		return failure(new InvalidCursorError("only one of after, before, or cursor may be given"));
	}

	if (after !== null) return success({ cursor: after, direction: "after" });
	if (before !== null) return success({ cursor: before, direction: "before" });

	if (ambient !== null) {
		let decoded = decodeCursor(ambient);
		if (isFailure(decoded)) return decoded;
		return success({ cursor: ambient, direction: decoded.data.direction });
	}

	return success({ cursor: null, direction: "after" });
}

/** Treats a blank cursor parameter as absent, since `?cursor=` carries no value. */
function emptyToNull(value: string | null | undefined): string | null {
	if (value === undefined || value === null) return null;
	return value.trim().length === 0 ? null : value;
}

/** Which neighbouring pages exist, and therefore which cursors are worth minting. */
interface CursorNeighbours {
	/** Whether a page follows the rows on hand. */
	hasNext: boolean;
	/** Whether a page precedes the rows on hand. */
	hasPrev: boolean;
}

/**
 * Mints the cursors for the edges of a page.
 *
 * The `next` cursor comes from the last row and `prev` from the first, each
 * tagged with the direction it seeks so one query parameter can carry either.
 */
function buildCursors<Row>(
	items: readonly Row[],
	columns: readonly string[],
	neighbours: CursorNeighbours,
): Result<KeysetCursors, PaginationError> {
	let first = items[0];
	let last = items[items.length - 1];

	let next: string | null = null;
	if (neighbours.hasNext && last !== undefined) {
		let encoded = encodeCursor("after", columns, readOrderingValues(last, columns));
		if (isFailure(encoded)) return encoded;
		next = encoded.data;
	}

	let prev: string | null = null;
	if (neighbours.hasPrev && first !== undefined) {
		let encoded = encodeCursor("before", columns, readOrderingValues(first, columns));
		if (isFailure(encoded)) return encoded;
		prev = encoded.data;
	}

	return success({ next, prev });
}

/** Reads every ordering column off one row, keeping positional alignment. */
function readOrderingValues(row: unknown, columns: readonly string[]): unknown[] {
	return columns.map((column) => readOrderingValue(row, column));
}
