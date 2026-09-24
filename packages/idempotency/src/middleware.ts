/**
 * Remix fetch-router middleware implementing the Idempotency-Key draft on the server: the
 * first `POST` or `PATCH` carrying a key runs once, its outcome is stored, and every retry
 * with that key gets the stored outcome back instead of a second write.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { Middleware, RequestContext } from "remix/router";

import { toMs } from "@sdxc/duration";
import { currentLog } from "@sdxc/logger";
import { problem } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";

import type { IdempotencyKeyError } from "./errors.js";
import type { IdempotencyStore } from "./types.js";

import { fingerprint } from "./fingerprint.js";
import { readIdempotencyKey } from "./header.js";
import { sha256Parts } from "./lib/digest.js";
import { fromStoredResponse, rebuildResponse, toStoredResponse } from "./lib/stored-response.js";

/** The methods the draft means the key for; the rest are idempotent already. */
const PROTECTED_METHODS = new Set(["POST", "PATCH"]);

/** Largest body stored when the caller sets no bound: 1 MiB. */
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/** Recorded when a retry is answered from the store. */
const REPLAYED_EVENT = "idempotency.replayed";

/** Recorded when a retry arrives while the first request still runs. */
const IN_FLIGHT_EVENT = "idempotency.in_flight";

/** Recorded when a key comes back with a different payload. */
const REUSED_EVENT = "idempotency.reused";

/** Recorded when the store fails a claim, completion or release. */
const STORE_UNAVAILABLE_EVENT = "idempotency.store_unavailable";

/** The builders the middleware answers refusals with; an app's catalog satisfies it structurally. */
export interface IdempotencyProblems {
	idempotencyKeyMissing(options?: { detail?: string }): Response;
	idempotencyKeyInvalid(options?: { detail?: string }): Response;
	idempotencyKeyInUse(options?: { detail?: string }): Response;
	idempotencyKeyReused(options?: { detail?: string }): Response;
}

/** How one registration of {@link idempotency} behaves. */
export interface IdempotencyOptions {
	/** Where records live; a function reads a per-request service off the context. */
	store: IdempotencyStore | ((context: RequestContext) => IdempotencyStore);
	/**
	 * Who the key belongs to: an API key id, a client id, a tenant and actor. Required,
	 * because a key scoped too widely would let one caller replay another's response.
	 */
	scope: (context: RequestContext) => string | Promise<string>;
	/** How long a completed outcome is replayed; the API docs state it, as the draft asks. */
	ttl: DurationInput;
	/**
	 * Answer `400` when the header is absent.
	 * @default false
	 */
	required?: boolean;
	/**
	 * How long an in-flight claim holds before a retry may take it over as abandoned.
	 * @default "1 minute"
	 */
	lease?: DurationInput;
	/**
	 * How a retry's payload is compared with the first request's; `false` compares keys alone.
	 * @default fingerprint
	 */
	fingerprint?: false | ((request: Request) => Promise<string>);
	/**
	 * Which outcomes are stored; any other releases the key so a retry runs the handler again.
	 * @default (response) => response.status < 500
	 */
	shouldStore?: (response: Response) => boolean;
	/**
	 * Largest body stored, in bytes; a larger one releases the key.
	 * @default 1048576
	 */
	maxBodyBytes?: number;
	/**
	 * What a store failure does: refuse with `503` (`closed`), or run the handler without
	 * protection (`open`).
	 * @default "closed"
	 */
	failurePolicy?: "open" | "closed";
	/**
	 * Namespace for record ids, keeping two registrations over one table apart.
	 * @default "idempotency"
	 */
	prefix?: string;
	/**
	 * The builders refusals are answered with, usually the app's problem catalog.
	 * @default `about:blank` problems carrying only the status
	 */
	problems?: IdempotencyProblems;
}

/** Refusals as `about:blank` problems, for an app that has no catalog of its own. */
const DEFAULT_PROBLEMS: IdempotencyProblems = {
	idempotencyKeyMissing: (options) => problem({ status: 400, detail: options?.detail }),
	idempotencyKeyInvalid: (options) => problem({ status: 400, detail: options?.detail }),
	idempotencyKeyInUse: (options) => problem({ status: 409, detail: options?.detail }),
	idempotencyKeyReused: (options) => problem({ status: 422, detail: options?.detail }),
};

/**
 * Creates the middleware. Place it after authentication, since the scope needs the caller,
 * and after rate limiting, so a replay still spends budget. Events go to the invocation's
 * log without the key or the scope, either of which may identify a caller.
 *
 * @param options - Store, scope, ttl and policy; see {@link IdempotencyOptions}
 * @returns A middleware that claims, runs, stores and replays
 * @example idempotency({ store: (ctx) => new DataTableStore(ctx.db), scope: (ctx) => ctx.apiKey.id, ttl: "24 hours" })
 */
export function idempotency(options: IdempotencyOptions): Middleware {
	let ttlMs = toMs(options.ttl);
	let leaseMs = toMs(options.lease ?? "1 minute");
	let computeFingerprint =
		options.fingerprint === false ? null : (options.fingerprint ?? fingerprint);
	let shouldStore = options.shouldStore ?? ((response: Response) => response.status < 500);
	let maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
	let failurePolicy = options.failurePolicy ?? "closed";
	let prefix = options.prefix ?? "idempotency";
	let problems = options.problems ?? DEFAULT_PROBLEMS;

	return async (context, next) => {
		let method = context.request.method.toUpperCase();
		if (!PROTECTED_METHODS.has(method)) return next();

		let key = readIdempotencyKey(context.request.headers);
		if (isFailure(key)) return problems.idempotencyKeyInvalid({ detail: invalidDetail(key.error) });
		if (key.data === null) {
			if (options.required !== true) return next();
			return problems.idempotencyKeyMissing({
				detail:
					'Send an Idempotency-Key header carrying a unique quoted string, such as Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324".',
			});
		}

		let store = typeof options.store === "function" ? options.store(context) : options.store;
		let scope = await options.scope(context);
		let id = await sha256Parts([
			prefix,
			scope,
			method,
			new URL(context.request.url).pathname,
			key.data,
		]);
		let print =
			computeFingerprint === null
				? null
				: await computeFingerprint(context.request.clone() as Request);
		let now = Date.now();
		let log = currentLog();

		let claimed = await store.claim({
			id,
			fingerprint: print,
			now,
			leaseMs,
			expiresAt: now + ttlMs,
		});
		if (isFailure(claimed)) {
			log?.warn(STORE_UNAVAILABLE_EVENT, {
				operation: "claim",
				policy: failurePolicy,
				error: claimed.error.message,
			});
			if (failurePolicy === "open") return next();
			return problem(
				{
					status: 503,
					detail: "Idempotency records are unavailable; retry the request with the same key.",
				},
				{ headers: { "Retry-After": "1" } },
			);
		}

		let outcome = claimed.data;
		if (outcome.status === "in-flight") {
			log?.warn(IN_FLIGHT_EVENT);
			let refusal = problems.idempotencyKeyInUse({
				detail: "A request with this key is still being processed; retry once it completes.",
			});
			return withRetryAfter(refusal);
		}
		if (outcome.status === "completed") {
			if (print !== null && outcome.fingerprint !== null && outcome.fingerprint !== print) {
				log?.warn(REUSED_EVENT);
				return problems.idempotencyKeyReused({
					detail:
						"This key was first sent with a different method, path or body; use a new key for a new request.",
				});
			}
			log?.note(REPLAYED_EVENT, { status: outcome.response.status });
			return fromStoredResponse(outcome.response);
		}

		let lease = outcome.lease;
		let release = async () => {
			let released = await store.release(id, lease);
			if (isFailure(released)) {
				log?.warn(STORE_UNAVAILABLE_EVENT, { operation: "release", error: released.error.message });
			}
		};

		let response: Response;
		try {
			response = await next();
		} catch (error) {
			await release();
			throw error;
		}

		if (!shouldStore(response) || Number(response.headers.get("Content-Length")) > maxBodyBytes) {
			await release();
			return response;
		}

		let body = new Uint8Array(await response.arrayBuffer());
		if (body.byteLength > maxBodyBytes) {
			await release();
			return rebuildResponse(response, body);
		}

		let completed = await store.complete(
			id,
			lease,
			toStoredResponse(response, body),
			Date.now() + ttlMs,
		);
		if (isFailure(completed)) {
			log?.warn(STORE_UNAVAILABLE_EVENT, { operation: "complete", error: completed.error.message });
		}
		return rebuildResponse(response, body);
	};
}

/**
 * The detail of an invalid-key refusal, telling the client how to write the header, since
 * an unquoted key is the mistake a client coming from provider-specific headers makes.
 *
 * @param error - Why the key was refused
 */
function invalidDetail(error: IdempotencyKeyError): string {
	if (error.reason === "too-long") return `${error.message}.`;
	return 'The Idempotency-Key value must be a quoted string (RFC 9651 sf-string), such as Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324".';
}

/**
 * Adds `Retry-After: 1` to a refusal, copying it so a response with immutable headers
 * works too.
 *
 * @param response - The `409` refusal
 */
function withRetryAfter(response: Response): Response {
	let headers = new Headers(response.headers);
	headers.set("Retry-After", "1");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
