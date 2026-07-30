/**
 * Response header annotation for a page: `Link` relations and `X-Total-Count`.
 *
 * The only thing this package writes to a response. It takes the `Headers` the
 * response is already being built with, merges its own four `Link` relations into
 * whatever is there, and hands the same instance back so the call can sit inline in
 * a `json()` or `ctx.render()` argument list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PagingNames } from "./names";
import type { KeysetPage, Page } from "./pagination";

import { parseLinkHeader, serializeLink, serializeLinkHeader } from "./link";
import { resolveNames } from "./names";

/** Header carrying the total row count, spelled the way client libraries look for it. */
const TOTAL_COUNT_HEADER = "X-Total-Count";

/** Relation types this package owns, and therefore replaces on every call. */
const PAGING_RELS = new Set(["first", "prev", "next", "last"]);

/** Where the advertised `Link` URLs point. */
export interface PaginateOptions {
	/**
	 * The URL this page was requested with; every other query parameter is preserved.
	 *
	 * Explicit rather than configured, so the same call works in an export job or a
	 * feed generator. A service behind a proxy must pass its public URL, or it will
	 * advertise internal hostnames to its clients.
	 */
	url: URL | string;
}

/**
 * Narrows a page to the offset shape.
 *
 * The two page types are told apart by the field only one of them carries, rather
 * than by a discriminant, because that is the shape the ADR fixed for them.
 */
function isOffsetPage<T>(page: Page<T> | KeysetPage<T>): page is Page<T> {
	return "pagination" in page;
}

/**
 * Builds a URL for one paging link, carrying every unrelated parameter over.
 *
 * The parameter belonging to the other strategy is dropped, so an offset link never
 * advertises a stale cursor and a keyset link never advertises a page number.
 */
function linkUrl(
	base: URL,
	names: PagingNames,
	parameter: "page" | "cursor",
	value: string,
): string {
	let url = new URL(base);
	url.searchParams.set(names[parameter], value);
	url.searchParams.delete(parameter === "page" ? names.cursor : names.page);
	return url.toString();
}

/**
 * Merges paging links into a `Link` header, keeping every link this package does not own.
 *
 * Its own four relations are dropped before the new ones are appended, which is what
 * makes a second call with the same page produce the same header, and what keeps
 * `rel="preload"` and the other resource hints that share this header alive.
 */
function mergeLinkHeader(headers: Headers, additions: readonly string[]): void {
	let kept = parseLinkHeader(headers.get("Link"))
		.filter((link) => !link.rels.some((rel) => PAGING_RELS.has(rel)))
		.map((link) => link.raw);

	let merged = serializeLinkHeader([...kept, ...additions]);

	if (merged === null) headers.delete("Link");
	else headers.set("Link", merged);
}

/**
 * Writes a page's headers into `headers`, with the paging parameter names applied.
 *
 * Shared by the standalone `paginate()` and by the bound `paginate` a `createPaging()`
 * factory returns, so both spell their `Link` URLs the same way they read a request.
 *
 * @param headers The response's own headers, mutated in place.
 * @param page An offset page or a keyset page.
 * @param options The URL the links are built from.
 * @param names What each paging parameter is called.
 * @returns The same `Headers` instance, so the call can be used inline.
 */
export function annotate<T>(
	headers: Headers,
	page: Page<T> | KeysetPage<T>,
	options: PaginateOptions,
	names: PagingNames,
): Headers {
	let base = typeof options.url === "string" ? new URL(options.url) : options.url;
	let additions: string[] = [];

	if (isOffsetPage(page)) {
		let pagination = page.pagination;

		additions.push(serializeLink(linkUrl(base, names, "page", "1"), "first"));
		if (pagination.prev !== null) {
			additions.push(serializeLink(linkUrl(base, names, "page", String(pagination.prev)), "prev"));
		}
		if (pagination.next !== null) {
			additions.push(serializeLink(linkUrl(base, names, "page", String(pagination.next)), "next"));
		}
		additions.push(serializeLink(linkUrl(base, names, "page", String(pagination.pages)), "last"));

		headers.set(TOTAL_COUNT_HEADER, String(pagination.total));
	} else {
		// A keyset page runs no count query, so it advertises no total and no first or
		// last relation: neither is reachable without knowing how many pages there are.
		if (page.cursors.prev !== null) {
			additions.push(serializeLink(linkUrl(base, names, "cursor", page.cursors.prev), "prev"));
		}
		if (page.cursors.next !== null) {
			additions.push(serializeLink(linkUrl(base, names, "cursor", page.cursors.next), "next"));
		}
	}

	mergeLinkHeader(headers, additions);

	return headers;
}

/**
 * Annotates a response's headers with the navigation for one page.
 *
 * `X-Total-Count` is replaced; `Link` is merged, so calling this twice with the same
 * page is a no-op and resource hints already on the response survive. An offset page
 * emits `first`, `prev`, `next`, `last`, and the total; a keyset page emits only the
 * cursor relations it can express.
 *
 * @param headers The response's own headers, mutated in place.
 * @param page The page to advertise; the shape decides which relations are emitted.
 * @param options The URL the links are built from.
 * @returns The same `Headers` instance, so it can be passed straight to a response.
 * @example
 * return json(page.items, { headers: paginate(headers, page, { url: ctx.url }) });
 */
export function paginate<T>(
	headers: Headers,
	page: Page<T> | KeysetPage<T>,
	options: PaginateOptions,
): Headers {
	return annotate(headers, page, options, resolveNames());
}
