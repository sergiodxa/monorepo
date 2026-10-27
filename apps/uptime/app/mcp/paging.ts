/**
 * Cursor paging shared by list tools: the same defaults and ceilings as `PAGING` on the
 * REST surface, expressed as tool-argument schemas a model fills directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeysetPage, PaginationError } from "@sdxc/pagination";
import type { Result } from "@sdxc/result";

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { ToolError } from "@sdxc/mcp";
import { InvalidCursorError } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";

/** Results per page when the caller names none; matches `PAGING`. */
export const DEFAULT_PER_PAGE = 50;

/** The largest page a list tool accepts; matches `PAGING`. */
export const MAX_PER_PAGE = 200;

/** A keyset cursor returned by a previous list call. */
export const CURSOR = s.optional(
	s.string().pipe(checks.minLength(1), checks.maxLength(2048)).meta({
		description:
			"A page reference a previous list call returned as nextCursor. Pass it back exactly; omit it for the first page.",
	}),
);

/** How many rows a page holds. */
export const PER_PAGE = s.defaulted(
	s
		.integer()
		.pipe(checks.min(1), checks.max(MAX_PER_PAGE))
		.meta({ description: `Results per page (default ${DEFAULT_PER_PAGE}, max ${MAX_PER_PAGE}).` }),
	DEFAULT_PER_PAGE,
);

/** The cursor + perPage fields every paginated list tool takes. */
export const PAGE_INPUT = {
	cursor: CURSOR,
	perPage: PER_PAGE,
} as const;

/** One page as list tools return it, with cursors the model can pass back. */
export interface ToolPage<T> {
	items: T[];
	nextCursor: string | null;
	prevCursor: string | null;
	perPage: number;
	total?: number;
}

/**
 * Turns a keyset page Result into the shape list tools return, throwing a {@link ToolError}
 * the model can act on when the cursor is bad.
 *
 * @param page - What `Pagination.byKeyset` answered.
 * @param perPage - The size the caller asked for.
 * @param serialize - Maps each row to its public shape.
 * @param total - Optional cheap count for collection lists.
 */
export function unwrapPage<Row, T>(
	page: Result<KeysetPage<Row>, PaginationError>,
	perPage: number,
	serialize: (row: Row) => T,
	total?: number,
): ToolPage<T> {
	if (isFailure(page)) {
		if (page.error instanceof InvalidCursorError) {
			throw new ToolError(`Invalid cursor: ${page.error.message}`);
		}
		throw new ToolError(page.error.message);
	}

	let result: ToolPage<T> = {
		items: page.data.items.map(serialize),
		nextCursor: page.data.cursors.next,
		prevCursor: page.data.cursors.prev,
		perPage,
	};
	if (total !== undefined) result.total = total;
	return result;
}
