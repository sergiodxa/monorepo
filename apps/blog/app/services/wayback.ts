/**
 * The Wayback Machine as the bookmarks use it: ask Save Page Now for a capture, follow the
 * capture until it lands, and look up the capture closest to a date. Every answer from the
 * archive is validated before it is trusted, and every failure is a value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import { boolean, object, optional, parseSafe, string } from "remix/data-schema";

/** Save Page Now's capture endpoint. */
const SAVE_URL = "https://web.archive.org/save";

/** Where a capture job's progress is read. */
const STATUS_URL = "https://web.archive.org/save/status/";

/** The Availability API, which answers the capture closest to a timestamp. */
const AVAILABLE_URL = "https://archive.org/wayback/available";

/** What a capture request answers: a job to follow, or why there is none. */
const SAVE_RESPONSE = object({
	job_id: optional(string()),
	message: optional(string()),
	status_ext: optional(string()),
});

/** What a capture job's status answers once it is read. */
const STATUS_RESPONSE = object({
	status: string(),
	timestamp: optional(string()),
	status_ext: optional(string()),
	message: optional(string()),
});

/** What the Availability API answers: the closest capture, when one exists. */
const AVAILABLE_RESPONSE = object({
	archived_snapshots: object({
		closest: optional(object({ available: boolean(), timestamp: string() })),
	}),
});

/** Types for talking to the Wayback Machine. */
export namespace Wayback {
	/** The archive.org account keys Save Page Now authenticates with. */
	export interface Keys {
		access: string;
		secret: string;
	}

	/** Where a capture job stands. */
	export type Capture =
		| { state: "pending" }
		| { state: "captured"; at: string }
		| { state: "failed"; reason: string };
}

/**
 * Why the archive could not be asked, with whether asking again later may work: `true` for
 * a rate limit or an outage, `false` for a request the archive refused outright.
 */
export class WaybackError extends Error {
	override name = "WaybackError";

	/**
	 * @param message What went wrong.
	 * @param retryable Whether the same request may succeed later.
	 * @param options The underlying failure, when there is one.
	 */
	constructor(
		message: string,
		public retryable: boolean,
		options?: ErrorOptions,
	) {
		super(message, options);
	}
}

/**
 * A Wayback timestamp (`YYYYMMDDhhmmss`) as an ISO instant, or `null` for one that does not
 * read as a date.
 *
 * @param timestamp The archive's fourteen-digit timestamp.
 */
export function instantOf(timestamp: string): string | null {
	let match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(timestamp);
	if (!match) return null;
	let [, year, month, day, hour, minute, second] = match;
	let instant = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
	return Number.isNaN(instant.getTime()) ? null : instant.toISOString();
}

/** An ISO instant as the archive's fourteen-digit timestamp. */
function timestampOf(instant: string): string {
	return new Date(instant).toISOString().replaceAll(/[-:T]/g, "").slice(0, 14);
}

/** The `Authorization` header Save Page Now reads an account's keys from. */
function authorization(keys: Wayback.Keys): string {
	return `LOW ${keys.access}:${keys.secret}`;
}

/** A response the archive answered with a failing status, as the error a caller acts on. */
function failed(response: Response, action: string): WaybackError {
	let retryable = response.status === 429 || response.status >= 500;
	return new WaybackError(`${action} answered ${response.status}`, retryable);
}

/**
 * Asks Save Page Now to capture a page.
 *
 * @param url The page to capture.
 * @param keys The account the capture is made under.
 * @returns The capture job to follow with {@link captureStatus}.
 */
export async function requestCapture(
	url: string,
	keys: Wayback.Keys,
): Promise<Result<string, WaybackError>> {
	let response = await fetch(SAVE_URL, {
		method: "POST",
		headers: {
			accept: "application/json",
			authorization: authorization(keys),
			"content-type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({ url }),
	}).catch(
		(error: unknown) => new WaybackError("Save Page Now was unreachable", true, { cause: error }),
	);
	if (response instanceof WaybackError) return failure(response);
	if (!response.ok) return failure(failed(response, "Save Page Now"));

	let body = parseSafe(SAVE_RESPONSE, await response.json().catch(() => null));
	if (!body.success)
		return failure(new WaybackError("Save Page Now answered an unknown shape", true));
	if (body.value.job_id) return success(body.value.job_id);

	let reason = body.value.status_ext ?? body.value.message ?? "no job";
	return failure(new WaybackError(`Save Page Now refused the capture: ${reason}`, false));
}

/**
 * Reads where a capture job stands.
 *
 * @param jobId The job {@link requestCapture} answered.
 * @param keys The account the capture was made under.
 * @returns The job's state, with the capture's instant once it landed.
 */
export async function captureStatus(
	jobId: string,
	keys: Wayback.Keys,
): Promise<Result<Wayback.Capture, WaybackError>> {
	let response = await fetch(`${STATUS_URL}${encodeURIComponent(jobId)}`, {
		headers: { accept: "application/json", authorization: authorization(keys) },
	}).catch(
		(error: unknown) => new WaybackError("Save Page Now was unreachable", true, { cause: error }),
	);
	if (response instanceof WaybackError) return failure(response);
	if (!response.ok) return failure(failed(response, "The capture status"));

	let body = parseSafe(STATUS_RESPONSE, await response.json().catch(() => null));
	if (!body.success)
		return failure(new WaybackError("The capture status has an unknown shape", true));

	if (body.value.status === "pending") return success({ state: "pending" });

	let at = body.value.status === "success" ? instantOf(body.value.timestamp ?? "") : null;
	if (at) return success({ state: "captured", at });

	return success({
		state: "failed",
		reason: body.value.status_ext ?? body.value.message ?? body.value.status,
	});
}

/**
 * The capture closest to a moment, from any crawl, or `null` when the archive holds none.
 *
 * @param url The page.
 * @param at The moment the capture should be closest to, as an ISO instant.
 * @returns The closest capture's instant.
 */
export async function closestCapture(
	url: string,
	at: string,
): Promise<Result<string | null, WaybackError>> {
	let query = new URLSearchParams({ url, timestamp: timestampOf(at) });
	let response = await fetch(`${AVAILABLE_URL}?${query}`, {
		headers: { accept: "application/json" },
	}).catch(
		(error: unknown) =>
			new WaybackError("The Availability API was unreachable", true, { cause: error }),
	);
	if (response instanceof WaybackError) return failure(response);
	if (!response.ok) return failure(failed(response, "The Availability API"));

	let body = parseSafe(AVAILABLE_RESPONSE, await response.json().catch(() => null));
	if (!body.success)
		return failure(new WaybackError("The Availability API answered an unknown shape", true));

	let closest = body.value.archived_snapshots.closest;
	if (!closest?.available) return success(null);
	return success(instantOf(closest.timestamp));
}
