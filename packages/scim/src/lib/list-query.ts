/**
 * Reads list requests: the query string of `GET /Users` and the `POST /.search` body
 * (RFC 7644 §3.4.2 and §3.4.3), with the RFC's defaults and clamping, and the request body
 * reader that accepts `application/scim+json` and `application/json`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Discovery } from "../discovery.js";
import type { Filter } from "../filter.js";
import type { Scim } from "../index.js";

import { isWireObject, readKey, resolvePath, schemaOfPath } from "./attributes.js";
import { SEARCH_REQUEST_SCHEMA } from "./constants.js";
import { badRequest, ScimError } from "./error.js";
import { compileFilter } from "./filter/compile.js";
import { parseFilter, parsePath } from "./filter/parse.js";

/** Options accepted by `parseListQuery` and `parseSearchRequest`. */
export interface ListQueryOptions {
	/**
	 * The page size when the request names none.
	 * @default 100
	 */
	defaultCount?: number;
	/** The largest page served; advertise the same value as `filter.maxResults`. Unbounded when omitted. */
	maxCount?: number;
	/** When given, the filter and every path must resolve against these definitions. */
	attributes?: Discovery.Definitions;
}

/** A list request's parameters before validation, from either the query string or a search body. */
interface RawQuery {
	filter: unknown;
	startIndex: unknown;
	count: unknown;
	sortBy: unknown;
	sortOrder: unknown;
	attributes: unknown;
	excludedAttributes: unknown;
}

/** The default page size RFC 7644 leaves to the service provider. */
const DEFAULT_COUNT = 100;

/**
 * Reads an integer parameter, from query-string text or a JSON number.
 *
 * @param value - The raw parameter
 * @param name - Its name, for the error detail
 * @returns The integer, `null` when absent, or `invalidValue`
 */
function readInteger(value: unknown, name: string): number | null | ScimError {
	if (value === undefined || value === null || value === "") return null;
	if (typeof value === "number" && Number.isInteger(value)) return value;
	if (typeof value === "string" && /^[+-]?\d+$/.test(value.trim())) return Number(value.trim());
	return badRequest("invalidValue", `${name} must be an integer.`);
}

/**
 * Reads an attribute list, from comma-separated query-string text or a JSON array of names.
 *
 * @param value - The raw parameter
 * @param name - Its name, for the error detail
 * @returns The names, or `invalidValue`
 */
function readNames(value: unknown, name: string): string[] | ScimError {
	if (value === undefined || value === null) return [];
	let items = typeof value === "string" ? value.split(",") : value;
	if (!Array.isArray(items) || !items.every((item) => typeof item === "string")) {
		return badRequest("invalidValue", `${name} must be a list of attribute names.`);
	}
	return items.map((item) => item.trim()).filter((item) => item !== "");
}

/**
 * Parses a path and, when definitions are given, checks it names an attribute or a whole schema.
 *
 * @param text - The path
 * @param definitions - The served definitions, when validating
 * @returns The path, or `invalidPath`
 */
function readPath(
	text: string,
	definitions: Discovery.Definitions | undefined,
): Filter.AttributePath | ScimError {
	let path = parsePath(text);
	if (isFailure(path)) return path.error;
	if (
		definitions &&
		!resolvePath(path.data, definitions) &&
		!schemaOfPath(path.data, definitions)
	) {
		return badRequest("invalidPath", `"${text}" is not a known attribute.`);
	}
	return path.data;
}

/**
 * Validates raw parameters into a list query. `startIndex` below 1 reads as 1 and `count`
 * below 0 as 0 (RFC 7644 §3.4.2.4); `count` above `maxCount` reads as `maxCount`.
 *
 * @param raw - The raw parameters
 * @param options - Page sizes and definitions
 * @returns The query, or the first invalid parameter
 */
function readQuery(raw: RawQuery, options: ListQueryOptions): Result<Scim.ListQuery, ScimError> {
	let maxCount = options.maxCount ?? Number.POSITIVE_INFINITY;
	let definitions = options.attributes;

	let filter: Filter.Expression | null = null;
	if (raw.filter !== undefined && raw.filter !== null && raw.filter !== "") {
		if (typeof raw.filter !== "string")
			return failure(badRequest("invalidFilter", "filter must be a string."));
		let parsed = parseFilter(raw.filter);
		if (isFailure(parsed)) return parsed;
		if (definitions) {
			let compiled = compileFilter(parsed.data, { definitions });
			if (isFailure(compiled)) return compiled;
		}
		filter = parsed.data;
	}

	let startIndex = readInteger(raw.startIndex, "startIndex");
	if (startIndex instanceof ScimError) return failure(startIndex);
	let count = readInteger(raw.count, "count");
	if (count instanceof ScimError) return failure(count);

	let sortBy: Filter.AttributePath | null = null;
	if (raw.sortBy !== undefined && raw.sortBy !== null && raw.sortBy !== "") {
		if (typeof raw.sortBy !== "string")
			return failure(badRequest("invalidPath", "sortBy must be a string."));
		let path = readPath(raw.sortBy, definitions);
		if (path instanceof ScimError) return failure(path);
		sortBy = path;
	}

	let sortOrder: Scim.ListQuery["sortOrder"] = "ascending";
	if (raw.sortOrder !== undefined && raw.sortOrder !== null && raw.sortOrder !== "") {
		let order = typeof raw.sortOrder === "string" ? raw.sortOrder.toLowerCase() : "";
		if (order !== "ascending" && order !== "descending") {
			return failure(badRequest("invalidValue", 'sortOrder must be "ascending" or "descending".'));
		}
		sortOrder = order;
	}

	let lists: Filter.AttributePath[][] = [];
	for (let name of ["attributes", "excludedAttributes"] as const) {
		let names = readNames(raw[name], name);
		if (names instanceof ScimError) return failure(names);
		let paths: Filter.AttributePath[] = [];
		for (let text of names) {
			let path = readPath(text, definitions);
			if (path instanceof ScimError) return failure(path);
			paths.push(path);
		}
		lists.push(paths);
	}

	return success({
		filter,
		startIndex: Math.max(startIndex ?? 1, 1),
		count: Math.min(
			Math.max(count ?? Math.min(options.defaultCount ?? DEFAULT_COUNT, maxCount), 0),
			maxCount,
		),
		sortBy,
		sortOrder,
		attributes: lists[0] ?? [],
		excludedAttributes: lists[1] ?? [],
	});
}

/**
 * Parses a list request's query string: `filter`, `startIndex`, `count`, `sortBy`,
 * `sortOrder`, `attributes` and `excludedAttributes`, parameter names matched exactly.
 *
 * @param url - The request URL
 * @param options - Page sizes, and definitions to validate paths against
 * @returns The query, or `400` with `invalidFilter`, `invalidPath` or `invalidValue`
 * @example parseListQuery(new URL(request.url), { maxCount: 200 })
 */
export function parseListQuery(
	url: URL,
	options: ListQueryOptions = {},
): Result<Scim.ListQuery, ScimError> {
	let get = (name: string) => url.searchParams.get(name) ?? undefined;
	return readQuery(
		{
			filter: get("filter"),
			startIndex: get("startIndex"),
			count: get("count"),
			sortBy: get("sortBy"),
			sortOrder: get("sortOrder"),
			attributes: get("attributes"),
			excludedAttributes: get("excludedAttributes"),
		},
		options,
	);
}

/**
 * Parses a `POST /.search` body (RFC 7644 §3.4.3) into the same query `parseListQuery`
 * reads. `schemas` must name the `SearchRequest` URN.
 *
 * @param body - The decoded JSON body
 * @param options - Page sizes, and definitions to validate paths against
 * @returns The query, or `400` with `invalidSyntax`, `invalidFilter`, `invalidPath` or `invalidValue`
 */
export function parseSearchRequest(
	body: unknown,
	options: ListQueryOptions = {},
): Result<Scim.ListQuery, ScimError> {
	if (!isWireObject(body))
		return failure(badRequest("invalidSyntax", "The body must be an object."));
	let schemas = readKey(body, "schemas");
	let declared =
		Array.isArray(schemas) &&
		schemas.some(
			(urn) => typeof urn === "string" && urn.toLowerCase() === SEARCH_REQUEST_SCHEMA.toLowerCase(),
		);
	if (!declared)
		return failure(badRequest("invalidSyntax", `schemas must include ${SEARCH_REQUEST_SCHEMA}.`));

	return readQuery(
		{
			filter: readKey(body, "filter"),
			startIndex: readKey(body, "startIndex"),
			count: readKey(body, "count"),
			sortBy: readKey(body, "sortBy"),
			sortOrder: readKey(body, "sortOrder"),
			attributes: readKey(body, "attributes"),
			excludedAttributes: readKey(body, "excludedAttributes"),
		},
		options,
	);
}

/**
 * Reads a request's JSON body. `application/scim+json` and `application/json` are accepted,
 * as is a body with no `Content-Type`; any other type is `415`, and text that is not JSON
 * is `400 invalidSyntax`.
 *
 * @param request - The incoming request
 * @returns The decoded body
 */
export async function readBody(request: Request): Promise<Result<unknown, ScimError>> {
	let type = request.headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase();
	if (type && type !== "application/scim+json" && type !== "application/json") {
		return failure(
			new ScimError(415, `${type} is not a SCIM content type; send application/scim+json.`),
		);
	}

	let text = await request.text();
	if (text.trim() === "") return failure(badRequest("invalidSyntax", "The request has no body."));
	try {
		return success(JSON.parse(text) as unknown);
	} catch {
		return failure(badRequest("invalidSyntax", "The body is not valid JSON."));
	}
}
