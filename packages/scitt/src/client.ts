/**
 * A SCRAPI client (draft-ietf-scitt-scrapi-11): registers Signed Statements with a
 * Transparency Service, polls for their Receipts, and reads the service's keys, honoring
 * `Retry-After` and backing off with jitter when the service gives no interval.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Backoff } from "@sdxc/backoff";
import type { CBORValue } from "@sdxc/cbor";
import type * as COSE from "@sdxc/cbor/cose";
import type { Result } from "@sdxc/result";

import { createBackoff } from "@sdxc/backoff";
import { decode, Tagged } from "@sdxc/cbor";
import { Base64Url } from "@sdxc/crypto";
import { failure, isFailure, success } from "@sdxc/result";

import { ServiceError } from "./errors.js";
import { CBOR_MEDIA_TYPE, COSE_MEDIA_TYPE, PROBLEM_MEDIA_TYPE } from "./labels.js";

/** How a `TransparencyService` client talks to its service. */
export interface TransparencyServiceOptions {
	/** Headers sent with every request, such as the `Authorization` the service requires. */
	headers?: HeadersInit;
	/** Polls `waitForReceipt` makes before failing `pending`. Default 10. */
	maxAttempts?: number;
	/** The wait between polls when the service sends no `Retry-After`. Default 1 s doubling to 1 min, ±20%. */
	backoff?: Backoff;
}

/** The outcome of registering a Signed Statement. */
export interface Registration {
	/** The Receipt resource; poll it, or fetch it later for a fresh receipt. */
	location: URL;
	/** The Receipt, when the service registered the statement synchronously. */
	receipt: Uint8Array | null;
	/** Milliseconds the service asked the client to wait before polling. */
	retryAfter: number | undefined;
}

/** The state of a Receipt resource. */
export type ReceiptStatus =
	| { status: "registered"; receipt: Uint8Array }
	| { status: "running"; retryAfter: number | undefined };

/** Options for one request. */
export interface RequestOptions {
	/** Cancels the request, and the polling `waitForReceipt` does. */
	signal?: AbortSignal;
}

/** Nesting a key set or problem details document may reach. */
const DOCUMENT_DEPTH = 8;

/** Statuses `waitForReceipt` retries after waiting, as SCRAPI's retry guidance covers. */
const RETRYABLE_STATUSES = new Set([429, 503]);

/**
 * A client for one Transparency Service, addressed by the origin its SCRAPI resources live
 * under. Every method answers a `Result` whose `ServiceError` carries the service's problem
 * details; no method throws.
 *
 * @example
 * let service = new TransparencyService("https://transparency.example", { headers: { authorization } });
 * let receipt = await service.submit(statement);
 */
export class TransparencyService {
	/** The service origin, which the well-known and `/entries` paths resolve against. */
	readonly url: URL;

	/** Headers sent with every request. */
	private headers: HeadersInit | undefined;

	/** Polls `waitForReceipt` makes. */
	private maxAttempts: number;

	/** The wait between polls without a `Retry-After`. */
	private backoff: Backoff;

	/**
	 * @param url The service's base URL.
	 * @param options Headers, polling limit and backoff.
	 */
	constructor(url: URL | string, options: TransparencyServiceOptions = {}) {
		this.url = new URL(url);
		this.headers = options.headers;
		this.maxAttempts = options.maxAttempts ?? 10;
		this.backoff =
			options.backoff ?? createBackoff({ base: "1 second", max: "1 minute", jitter: 0.2 });
	}

	/**
	 * Registers a Signed Statement (`POST /entries`). A `201` carries the Receipt at once; a
	 * `202` carries only the `location` to poll.
	 *
	 * @param statement The Signed Statement's COSE_Sign1 bytes.
	 * @returns The registration, or the service's refusal as an `error-response`.
	 * @example
	 * let registration = await service.register(statement);
	 */
	async register(
		statement: Uint8Array,
		options: RequestOptions = {},
	): Promise<Result<Registration, ServiceError>> {
		let response = await this.request(new URL("entries", this.base()), {
			method: "POST",
			accept: `${COSE_MEDIA_TYPE}, ${PROBLEM_MEDIA_TYPE}`,
			contentType: COSE_MEDIA_TYPE,
			body: statement,
			signal: options.signal,
		});
		if (isFailure(response)) return response;
		let { status, headers, body } = response.data;

		if (status !== 201 && status !== 202) return failure(unexpected(status));
		let location = headers.get("location");
		if (!location)
			return failure(
				new ServiceError("invalid-response", "registration response has no Location", { status }),
			);

		return success({
			location: new URL(location, this.url),
			receipt: status === 201 ? body : null,
			retryAfter: retryAfter(headers),
		});
	}

	/**
	 * Resolves a Receipt resource once: `registered` with the receipt, or `running` while the
	 * service is still registering. A registration that failed is an `error-response` with
	 * status 404.
	 *
	 * @param entry The `location` from `register`, or an entry ID under `/entries/`.
	 * @example
	 * let state = await service.receipt(registration.location);
	 */
	async receipt(
		entry: URL | string,
		options: RequestOptions = {},
	): Promise<Result<ReceiptStatus, ServiceError>> {
		let response = await this.request(this.entryURL(entry), {
			accept: `${COSE_MEDIA_TYPE}, ${PROBLEM_MEDIA_TYPE}`,
			signal: options.signal,
		});
		if (isFailure(response)) return response;
		let { status, headers, body } = response.data;

		if (status === 200) return success({ status: "registered", receipt: body });
		if (status === 202 || status === 204)
			return success({ status: "running", retryAfter: retryAfter(headers) });
		return failure(unexpected(status));
	}

	/**
	 * Polls a Receipt resource until the receipt is ready, waiting the `Retry-After` the service
	 * sends or, without one, the backoff. A `429` or `503` is waited out the same way. After
	 * `maxAttempts` polls it fails `pending`.
	 *
	 * @param entry The `location` from `register`, or an entry ID.
	 * @param options `retryAfter`: a first wait in milliseconds, such as `register`'s; `signal`.
	 * @example
	 * let receipt = await service.waitForReceipt(registration.location, { signal });
	 */
	async waitForReceipt(
		entry: URL | string,
		options: RequestOptions & { retryAfter?: number } = {},
	): Promise<Result<Uint8Array, ServiceError>> {
		let wait = options.retryAfter;
		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			if (wait !== undefined && wait > 0) {
				let slept = await sleep(wait, options.signal);
				if (isFailure(slept)) return slept;
			}

			let state = await this.receipt(entry, options);
			if (isFailure(state)) {
				let status = state.error.status;
				if (status === undefined || !RETRYABLE_STATUSES.has(status)) return state;
				wait = state.error.retryAfter ?? this.backoff.delay(attempt);
				continue;
			}
			if (state.data.status === "registered") return success(state.data.receipt);
			wait = state.data.retryAfter ?? this.backoff.delay(attempt);
		}
		return failure(new ServiceError("pending", `no receipt after ${this.maxAttempts} polls`));
	}

	/**
	 * Registers a Signed Statement and waits for its Receipt, however the service answers.
	 *
	 * @returns The Receipt bytes.
	 * @example
	 * let receipt = await service.submit(statement);
	 */
	async submit(
		statement: Uint8Array,
		options: RequestOptions = {},
	): Promise<Result<Uint8Array, ServiceError>> {
		let registration = await this.register(statement, options);
		if (isFailure(registration)) return registration;
		if (registration.data.receipt) return success(registration.data.receipt);
		return this.waitForReceipt(registration.data.location, {
			...options,
			retryAfter: registration.data.retryAfter,
		});
	}

	/**
	 * The keys the service signs Receipts with (`/.well-known/scitt-keys`), a COSE Key Set.
	 *
	 * @example
	 * let keys = await service.keys(); // pass to verifyReceipt as `keys`
	 */
	async keys(options: RequestOptions = {}): Promise<Result<COSE.Key[], ServiceError>> {
		let response = await this.request(new URL(".well-known/scitt-keys", this.url.origin + "/"), {
			accept: CBOR_MEDIA_TYPE,
			signal: options.signal,
		});
		if (isFailure(response)) return response;
		if (response.data.status !== 200) return failure(unexpected(response.data.status));

		let set = decode(response.data.body, { maxDepth: DOCUMENT_DEPTH });
		if (
			isFailure(set) ||
			!Array.isArray(set.data) ||
			!set.data.every((key) => key instanceof Map)
		) {
			return failure(
				new ServiceError("invalid-response", "key set is not a CBOR array of COSE keys", {
					status: 200,
				}),
			);
		}
		return success(set.data as COSE.Key[]);
	}

	/**
	 * One service key by `kid` (`/.well-known/scitt-keys/{kid}`), addressed by the base64url
	 * form SCRAPI requires every service to accept. An unknown kid is an `error-response` 404.
	 *
	 * @param kid The `kid` from a Receipt's protected header.
	 * @example
	 * let key = await service.key(receipt.kid);
	 */
	async key(
		kid: Uint8Array | string,
		options: RequestOptions = {},
	): Promise<Result<COSE.Key, ServiceError>> {
		let segment = Base64Url.encode(typeof kid === "string" ? new TextEncoder().encode(kid) : kid);
		let response = await this.request(
			new URL(`.well-known/scitt-keys/${segment}`, this.url.origin + "/"),
			{
				accept: CBOR_MEDIA_TYPE,
				signal: options.signal,
			},
		);
		if (isFailure(response)) return response;
		if (response.data.status !== 200) return failure(unexpected(response.data.status));

		let key = decode(response.data.body, { maxDepth: DOCUMENT_DEPTH });
		if (isFailure(key) || !(key.data instanceof Map)) {
			return failure(
				new ServiceError("invalid-response", "key is not a COSE key", { status: 200 }),
			);
		}
		return success(key.data);
	}

	/** The base URL with a trailing slash, so relative paths resolve beneath it. */
	private base(): URL {
		return new URL(this.url.href.endsWith("/") ? this.url.href : `${this.url.href}/`);
	}

	/** The Receipt resource for a location URL or an entry ID. */
	private entryURL(entry: URL | string): URL {
		return entry instanceof URL
			? entry
			: new URL(`entries/${encodeURIComponent(entry)}`, this.base());
	}

	/**
	 * Sends one request and reads the body. A response of 400 or above becomes an
	 * `error-response` carrying its Concise Problem Details and `Retry-After`.
	 */
	private async request(
		url: URL,
		init: {
			method?: string;
			accept: string;
			contentType?: string;
			body?: Uint8Array;
			signal?: AbortSignal;
		},
	): Promise<Result<{ status: number; headers: Headers; body: Uint8Array }, ServiceError>> {
		let headers = new Headers(this.headers);
		headers.set("accept", init.accept);
		if (init.contentType) headers.set("content-type", init.contentType);

		let response: Response;
		let body: Uint8Array;
		try {
			response = await fetch(url, {
				method: init.method ?? "GET",
				headers,
				body: init.body ? Uint8Array.from(init.body) : undefined,
				signal: init.signal,
			});
			body = new Uint8Array(await response.arrayBuffer());
		} catch (cause) {
			return failure(new ServiceError("network-error", `request to ${url.href} failed`, { cause }));
		}

		if (response.status >= 400) {
			let problem = readProblem(body);
			return failure(
				new ServiceError("error-response", problem.title ?? `service answered ${response.status}`, {
					status: response.status,
					title: problem.title,
					detail: problem.detail,
					retryAfter: retryAfter(response.headers),
				}),
			);
		}
		return success({ status: response.status, headers: response.headers, body });
	}
}

/** The failure for a status the exchange does not define. */
function unexpected(status: number): ServiceError {
	return new ServiceError("invalid-response", `unexpected status ${status}`, { status });
}

/**
 * The title and detail of an RFC 9290 Concise Problem Details body (keys -1 and -2). A
 * language-tagged string (tag 38) reads as its text; any other body yields neither.
 */
function readProblem(body: Uint8Array): { title?: string; detail?: string } {
	if (body.length === 0) return {};
	let decoded = decode(body, { maxDepth: DOCUMENT_DEPTH });
	if (isFailure(decoded) || !(decoded.data instanceof Map)) return {};
	return { title: text(decoded.data.get(-1)), detail: text(decoded.data.get(-2)) };
}

/** The text of an RFC 9290 `oltext`: a plain string, or tag 38 around `[language, text]`. */
function text(value: CBORValue): string | undefined {
	if (typeof value === "string") return value;
	if (value instanceof Tagged && value.tag === 38 && Array.isArray(value.value)) {
		let inner = value.value[1];
		return typeof inner === "string" ? inner : undefined;
	}
	return undefined;
}

/**
 * The `Retry-After` header in milliseconds: delay-seconds, or an HTTP date measured from now.
 * A missing or unreadable header is `undefined`.
 */
function retryAfter(headers: Headers): number | undefined {
	let value = headers.get("retry-after")?.trim();
	if (!value) return undefined;
	if (/^\d+$/.test(value)) return Number(value) * 1000;
	let date = Date.parse(value);
	return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Waits `ms`, failing `network-error` when `signal` aborts first. */
function sleep(ms: number, signal: AbortSignal | undefined): Promise<Result<void, ServiceError>> {
	return new Promise((resolve) => {
		let aborted = () => {
			clearTimeout(timer);
			resolve(
				failure(
					new ServiceError("network-error", "polling was aborted", { cause: signal?.reason }),
				),
			);
		};
		let timer = setTimeout(() => {
			signal?.removeEventListener("abort", aborted);
			resolve(success(undefined));
		}, ms);
		if (signal?.aborted) aborted();
		else signal?.addEventListener("abort", aborted, { once: true });
	});
}
