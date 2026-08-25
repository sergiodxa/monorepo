/**
 * Request parameter parsing, and the factory that binds parameter names once.
 *
 * A page number and a page size arrive as untrusted text, so they are validated in
 * one place: non-numeric, fractional, negative, and oversized values all become a
 * `Result` failure the caller can act on. `createPaging()` hands back the
 * same parsing and the same header annotation with the names already applied, so an
 * API cannot accept `?per_page=50` while advertising `?perPage=50`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";
import type { ValidationError as ValidateError } from "@pkg/validate";

import { failure, success } from "@pkg/result";
import { ValidationError } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

import type { PaginateOptions } from "./headers";
import type { PagingNames } from "./names";
import type { KeysetPage, Page } from "./pagination";

import { annotate } from "./headers";
import { DEFAULT_MAX_PER_PAGE, DEFAULT_PER_PAGE, resolveNames } from "./names";

/** The paging parameters a request asked for, after validation. */
export interface PageParams {
	/** Requested page, 1-based; at least 1, but not yet clamped against a total. */
	page: number;
	/** Requested page size, within `1..maxPerPage`. */
	perPage: number;
	/** Opaque keyset cursor, or `null` when the request did not send one. */
	cursor: string | null;
}

/** Page-size defaults and limits applied while parsing. */
export interface ParsePageParamsOptions {
	/** Page size to use when the request does not ask for one, default 25. */
	perPage?: number;
	/** Largest page size a request may ask for, default 100. */
	maxPerPage?: number;
}

/** How a `createPaging()` factory reads and writes paging parameters. */
export interface CreatePagingOptions extends ParsePageParamsOptions {
	/**
	 * What each paging parameter is called, defaulted per field.
	 *
	 * Custom names exist only here, which is what stops parsing and `Link` generation
	 * from disagreeing about the spelling.
	 */
	names?: Partial<PagingNames>;
}

/** Parsing and header annotation with names and page-size limits already bound. */
export interface Paging {
	/**
	 * Reads the bound parameter names off a request's query string.
	 *
	 * @param searchParams The request URL's search parameters.
	 * @returns The requested page, page size, and cursor, or a `ValidationError`.
	 */
	parse(searchParams: URLSearchParams): Result<PageParams, ValidateError>;
	/**
	 * Annotates a response's headers, spelling the bound names in every `Link` URL.
	 *
	 * @param headers The response's own headers, mutated in place.
	 * @param page The page to advertise.
	 * @param options The URL the links are built from.
	 * @returns The same `Headers` instance.
	 */
	paginate<T>(headers: Headers, page: Page<T> | KeysetPage<T>, options: PaginateOptions): Headers;
}

/**
 * Reads one query parameter, treating a blank value as absent.
 *
 * `?page=` carries no number, and defaulting it is friendlier than failing a request
 * over a trailing parameter a client left empty.
 */
function readParam(searchParams: URLSearchParams, name: string): string | undefined {
	let raw = searchParams.get(name);
	if (raw === null || raw.trim().length === 0) return undefined;
	return raw;
}

/**
 * Builds the schema for one call's defaults and limits.
 *
 * Built per call, since `perPage` and `maxPerPage` are decided by the route and
 * belong in the schema itself, so an oversized page size names its own limit.
 */
function pageParamsSchema(perPage: number, maxPerPage: number) {
	return s.object({
		page: s.defaulted(
			coerce
				.number()
				.pipe(checks.min(1))
				.refine((value) => Number.isInteger(value), "Expected a whole page number"),
			1,
		),
		perPage: s.defaulted(
			coerce
				.number()
				.pipe(checks.min(1), checks.max(maxPerPage))
				.refine((value) => Number.isInteger(value), "Expected a whole page size"),
			perPage,
		),
		cursor: s.optional(s.string()),
	});
}

/**
 * Validates the paging parameters on a request URL.
 *
 * Fails for a page below 1, a non-whole page, or a page size above `maxPerPage`;
 * a page past the end succeeds, since clamping belongs to `Pagination`.
 *
 * @param searchParams The request URL's search parameters.
 * @param options Page-size default and ceiling.
 * @returns The requested page, page size, and cursor, or a `ValidationError`.
 * @example
 * let params = parsePageParams(ctx.url.searchParams, { perPage: 25, maxPerPage: 100 });
 */
export function parsePageParams(
	searchParams: URLSearchParams,
	options?: ParsePageParamsOptions,
): Result<PageParams, ValidateError> {
	return parseWithNames(searchParams, options, resolveNames());
}

/**
 * Validates paging parameters read under a given set of names.
 *
 * Shared by the standalone `parsePageParams()` and the bound `parse` a factory
 * returns, so both apply the same rules to differently spelled parameters.
 */
function parseWithNames(
	searchParams: URLSearchParams,
	options: ParsePageParamsOptions | undefined,
	names: PagingNames,
): Result<PageParams, ValidateError> {
	let perPage = options?.perPage ?? DEFAULT_PER_PAGE;
	let maxPerPage = options?.maxPerPage ?? DEFAULT_MAX_PER_PAGE;

	let result = s.parseSafe(pageParamsSchema(perPage, maxPerPage), {
		page: readParam(searchParams, names.page),
		perPage: readParam(searchParams, names.perPage),
		cursor: readParam(searchParams, names.cursor),
	});

	if (!result.success) return failure(new ValidationError(result.issues));

	return success({
		page: result.value.page,
		perPage: result.value.perPage,
		cursor: result.value.cursor ?? null,
	});
}

/**
 * Binds parameter names and page-size limits to the two functions that need them.
 *
 * Reaching both `parse` and `paginate` through one factory guarantees a route
 * reads the same spelling it advertises.
 *
 * @param options Parameter names, page-size default, and page-size ceiling.
 * @returns Parsing and header annotation with those names and limits applied.
 * @example
 * const PAGING = createPaging({ names: { perPage: "per_page" }, perPage: 25, maxPerPage: 100 });
 */
export function createPaging(options?: CreatePagingOptions): Paging {
	let names = resolveNames(options?.names);
	let limits: ParsePageParamsOptions = {
		perPage: options?.perPage,
		maxPerPage: options?.maxPerPage,
	};

	return {
		parse(searchParams) {
			return parseWithNames(searchParams, limits, names);
		},

		paginate(headers, page, paginateOptions) {
			return annotate(headers, page, paginateOptions, names);
		},
	};
}
