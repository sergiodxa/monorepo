/**
 * Success envelope for the `/api/v1/*` surface: `apiSuccess` wraps a payload in `{
 * data, meta: { requestId, timestamp } }`; failures are problem details from
 * `problems.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StatusCode } from "@sdxc/http/status-code";

import { json } from "@sdxc/http/response";
import { Ok } from "@sdxc/http/status-code";
import { generateUUID } from "@sdxc/uuid/v4";

/** Where a paginated response advertises the pages around this one. */
export interface PageMeta {
	/** Cursor for the following page, or `null` on the last page. */
	next: string | null;
	/** Cursor for the preceding page, or `null` on the first page. */
	prev: string | null;
	/** Results this page was built with. */
	perPage: number;
	/**
	 * Rows matching the request across every page. Present on the collections, whose
	 * size is bounded by a product limit or by retention.
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
