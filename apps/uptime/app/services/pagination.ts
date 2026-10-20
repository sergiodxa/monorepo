/**
 * The paging vocabulary the whole `/api/v1/*` surface reads and advertises. Every
 * list the API serves is append-only history — check results, alert events, and
 * the collections that grow alongside them — so all of them page by keyset: a
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StatusCode } from "@sdxc/http/status-code";
import type { KeysetPage, OrderByTuple } from "@sdxc/pagination";

import { Ok } from "@sdxc/http/status-code";
import { createPaging } from "@sdxc/pagination";

import { apiSuccess } from "~/app/services/api/response";

/**
 * Parsing and `Link` annotation with the API's parameter names and page sizes bound.
 *
 * Keyset paging reads `cursor` and `perPage`; `page` is bound too so the factory
 * stays whole, and a request that sends it is simply parsed and ignored.
 */
export const PAGING = createPaging({ perPage: 50, maxPerPage: 200 });

/**
 * Builds the newest-first ordering a paginated endpoint seeks by. A timestamp
 * alone repeats or skips rows that share it, which is routine when a minute's
 * worth of checks lands together, so `id` is always the tiebreaker; every table
 *
 * @param column The table's own timestamp column.
 * @returns The sort keys, most significant first.
 * @example
 * Pagination.byKeyset(db.query(tcpMonitorResults), { orderBy: newestFirst("checked_at"), limit });
 */
export function newestFirst(column: string): readonly OrderByTuple[] {
	return [
		[column, "desc"],
		["id", "desc"],
	];
}

/** The ordering for a table that stamps `created_at`, which is most of them. */
export const NEWEST_FIRST: readonly OrderByTuple[] = newestFirst("created_at");

/**
 * Answers with one page of a list, advertised in both `Link` and `meta.pagination`.
 * A caller hands over the payload it serialized and the page it came from; the
 * cursors are read off that one page, so the header and the body cannot disagree
 *
 * @param data The serialized payload, shaped as the endpoint's own body.
 * @param page The page the payload was built from.
 * @param options The request URL the links are built from, the size asked for, and a total for a collection whose rows are cheap to count.
 * @returns The JSON response, carrying the paging headers.
 * @example
 * return apiPage({ results }, page.data, { url: ctx.url, perPage: params.data.perPage });
 */
export function apiPage<T, Row>(
	data: T,
	page: KeysetPage<Row>,
	options: { url: URL; perPage: number; total?: number; status?: StatusCode },
): Response {
	return apiSuccess(data, options.status ?? Ok, {
		headers: PAGING.paginate(new Headers(), page, { url: options.url }),
		pagination: {
			next: page.cursors.next,
			prev: page.cursors.prev,
			perPage: options.perPage,
			...(options.total !== undefined && { total: options.total }),
		},
	});
}
