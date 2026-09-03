/**
 * JSON envelope helpers for the `/api/v1/*` surface: `apiSuccess` wraps a payload in
 * `{ data, meta: { requestId, timestamp } }` and `apiError` wraps a failure in
 * `{ error: { code, message } }`, matching the response shape every existing API
 * integration (including the self-monitoring `UPTIME_CRON_API_KEY` loop) already
 * expects. Also exposes a small pagination-query parser shared by every paginated
 * list endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StatusCode } from "@sdxc/http/status-code";

import { json } from "@sdxc/http/response";
import { Ok } from "@sdxc/http/status-code";
import { generateUUID } from "@sdxc/uuid";

/** Envelope for a successful API response. */
export interface ApiSuccessBody<T> {
	data: T;
	meta: { requestId: string; timestamp: string };
}

/** Envelope for a failed API response. */
export interface ApiErrorBody {
	error: { code: string; message: string };
}

/** Builds the standard success envelope and JSON response for `/api/v1/*` endpoints. */
export function apiSuccess<T>(data: T, status: StatusCode = Ok): Response {
	let body: ApiSuccessBody<T> = {
		data,
		meta: { requestId: generateUUID(), timestamp: new Date().toISOString() },
	};
	return json(body, status);
}

/** Builds the standard error envelope and JSON response for `/api/v1/*` endpoints. */
export function apiError(code: string, message: string, status: StatusCode): Response {
	let body: ApiErrorBody = { error: { code, message } };
	return json(body, status);
}

/** Parsed and clamped `limit`/`offset` query parameters for a paginated list endpoint. */
export interface PaginationQuery {
	limit: number;
	offset: number;
}

/**
 * Reads and clamps `limit`/`offset` query parameters, falling back to the defaults
 * on missing or non-numeric values so every paginated endpoint stays answerable.
 */
export function parsePaginationQuery(
	url: URL,
	options: { defaultLimit: number; maxLimit: number } = { defaultLimit: 50, maxLimit: 100 },
): PaginationQuery {
	let limitParam = Number(url.searchParams.get("limit"));
	let offsetParam = Number(url.searchParams.get("offset"));

	let limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : options.defaultLimit;
	let offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

	return { limit: Math.min(Math.trunc(limit), options.maxLimit), offset: Math.trunc(offset) };
}
