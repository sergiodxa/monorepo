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

export type { CursorDirection, CursorValue, DecodedCursor } from "./cursor";
export type { PaginateOptions } from "./headers";
export type { OrderByTuple, OrderDirection } from "./keyset";
export type { PagingNames } from "./names";
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
} from "./pagination";
export type { CreatePagingOptions, PageParams, Paging, ParsePageParamsOptions } from "./params";

export { decodeCursor, encodeCursor } from "./cursor";
export {
	InvalidCursorError,
	InvalidOrderingError,
	PaginationError,
	QueryFailedError,
	UnencodableCursorValueError,
} from "./errors";
export { paginate } from "./headers";
export { DEFAULT_MAX_PER_PAGE, DEFAULT_PAGING_NAMES, DEFAULT_PER_PAGE } from "./names";
export { Pagination } from "./pagination";
export { createPaging, parsePageParams } from "./params";
