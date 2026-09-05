/**
 * JSON envelope helpers for the `/api/v1/*` surface: `apiSuccess` wraps a payload in
 * `{ data, meta: { requestId, timestamp } }` and `apiError` wraps a failure in
 * `{ error: { code, message } }`, matching the response shape every existing API
 * integration (including the self-monitoring `UPTIME_CRON_API_KEY` loop) already
 * expects. A paginated endpoint reaches this through `apiPage`, which fills in both
 * the `Link` headers and `meta.pagination` from one page, so the two always agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StatusCode } from "@sdxc/http/status-code";

import { json } from "@sdxc/http/response";
import { Ok } from "@sdxc/http/status-code";
import { generateUUID } from "@sdxc/uuid";

/** Where a paginated response advertises the pages around this one. */
export interface PageMeta {
	/** Cursor for the following page, or `null` on the last page. */
	next: string | null;
	/** Cursor for the preceding page, or `null` on the first page. */
	prev: string | null;
	/** Results this page was built with. */
	perPage: number;
	/**
	 * Rows matching the request across every page.
	 *
	 * Present on the collections, whose size is bounded by a product limit or by
	 * retention. A history feed omits it rather than counting a table that a busy
	 * monitor fills, so paging one stays a single query.
	 */
	total?: number;
}

/** Response-level information every successful API response carries. */
export interface ApiMeta {
	requestId: string;
	timestamp: string;
	/** Present on a paginated response, absent on every other. */
	pagination?: PageMeta;
}

/** Envelope for a successful API response. */
export interface ApiSuccessBody<T> {
	data: T;
	meta: ApiMeta;
}

/** Envelope for a failed API response. */
export interface ApiErrorBody {
	error: { code: string; message: string };
}

/**
 * Builds the standard success envelope and JSON response for `/api/v1/*` endpoints.
 *
 * @param data The payload to wrap.
 * @param status The status to answer with, `200 OK` by default.
 * @param options Headers to send, and the cursors a paginated list advertises.
 */
export function apiSuccess<T>(
	data: T,
	status: StatusCode = Ok,
	options: { headers?: Headers; pagination?: PageMeta } = {},
): Response {
	let body: ApiSuccessBody<T> = {
		data,
		meta: {
			requestId: generateUUID(),
			timestamp: new Date().toISOString(),
			...(options.pagination && { pagination: options.pagination }),
		},
	};
	return json(body, { ...status, headers: options.headers });
}

/** Builds the standard error envelope and JSON response for `/api/v1/*` endpoints. */
export function apiError(code: string, message: string, status: StatusCode): Response {
	let body: ApiErrorBody = { error: { code, message } };
	return json(body, status);
}
