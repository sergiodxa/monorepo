/**
 * Page arithmetic, query strategies, parameter parsing, and response headers.
 *
 * One vocabulary for paging: a `Pagination` value object holding the arithmetic, an
 * offset and a keyset strategy over a `remix/data-table` query, validated request
 * parameters, and `Link`/`X-Total-Count` annotation. It returns data and headers
 * for the caller to assemble into a response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { CursorDirection, CursorValue, DecodedCursor } from "./cursor.js";
export type { PaginateOptions } from "./headers.js";
export type { OrderByTuple, OrderDirection } from "./keyset.js";
export type { PagingNames } from "./names.js";
export type {
	KeysetCursors,
	KeysetOptions,
	KeysetPage,
	KeysetQuery,
	OffsetOptions,
	OffsetQuery,
	Page,
	PageSeries,
	PageSeriesItem,
	PageSeriesOptions,
	PaginationInit,
	PaginationJSON,
} from "./pagination.js";
export type { CreatePagingOptions, PageParams, Paging, ParsePageParamsOptions } from "./params.js";

export { decodeCursor, encodeCursor } from "./cursor.js";
export {
	InvalidCursorError,
	InvalidOrderingError,
	PaginationError,
	QueryFailedError,
	UnencodableCursorValueError,
} from "./errors.js";
export { paginate } from "./headers.js";
export { DEFAULT_MAX_PER_PAGE, DEFAULT_PAGING_NAMES, DEFAULT_PER_PAGE } from "./names.js";
export { Pagination } from "./pagination.js";
export { createPaging, parsePageParams } from "./params.js";
