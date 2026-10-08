/**
 * Signs and POSTs one activity to one inbox, knocking first with the scheme the origin
 * accepted last time and falling back to the other one, and maps the answer to a
 * `DeliveryError` whose `retryable` and `retryAfter` drive the job's retry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Cache } from "@sdxc/cache";
import type { DurationInput } from "@sdxc/duration";
import type { AcceptSignature, Component, Scheme, SignOptions } from "@sdxc/http-signatures";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { parseAcceptSignature, sign } from "@sdxc/http-signatures";
import { checkUrl, release, resolveHost } from "@sdxc/outbound";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { ActorKeys } from "../keys.js";
import type { KeyProvider } from "../store.js";

import { ActivityPubError } from "../errors.js";

import { recordFailure, recordSuccess } from "./availability.js";
import { ACTIVITY_ACCEPT, ACTIVITY_JSON } from "./constants.js";

/** Long enough for a busy instance to answer a POST, short enough to keep a consumer moving. */
const DEFAULT_TIMEOUT: DurationInput = "15 seconds";

/** How long an origin's accepted scheme is reused, so it pays for a second knock about monthly. */
const SCHEME_TTL: DurationInput = "30 days";

/** How long a signature honoring an `Accept-Signature` request with `expires` stays valid. */
const REQUESTED_EXPIRY_MS = toMs("5 minutes");

/**
 * The longest wait a `Retry-After` can ask for, equal to the longest `DELIVERY_BACKOFF` step,
 * so a hostile inbox cannot hold a delivery past the job's retry schedule.
 */
const MAX_RETRY_AFTER_MS = toMs("12 hours");

/** The answers that mean "not with this signature", which a knock with another scheme can change. */
const REFUSED_STATUSES = new Set([400, 401, 403]);

/**
 * What every delivery signature covers whatever an inbox asks for, so `Accept-Signature`
 * can never obtain this actor's signature over less than the target, the method and the body.
 */
const REQUIRED_COMPONENTS: readonly string[] = ["@method", "@target-uri", "content-digest"];

/** The schemes in the order a first delivery to an origin tries them. */
const DEFAULT_ORDER: readonly Scheme[] = ["rfc9421", "draft-cavage"];

/**
 * Why a delivery did not land. `gone` means the inbox answered `410`, so the caller drops
 * the followers reached through it; `rate-limited`, `server`, `timeout`, `network` and
 * `keys-unavailable` are the outcomes a later attempt can change.
 */
export type DeliveryErrorCode =
	| "gone"
	| "unauthorized"
	| "rate-limited"
	| "rejected"
	| "server"
	| "timeout"
	| "network"
	| "refused-url"
	| "missing-keys"
	| "keys-unavailable"
	| "unsignable";

/** The codes a retry can clear; every other one repeats the same answer. */
const RETRYABLE_CODES = new Set<DeliveryErrorCode>([
	"rate-limited",
	"server",
	"timeout",
	"network",
	"keys-unavailable",
]);

/**
 * A delivery that failed. A job retries it when `retryable`, waiting at least `retryAfter`
 * milliseconds when the inbox named a time, and acknowledges it otherwise.
 */
export class DeliveryError extends ActivityPubError<DeliveryErrorCode> {
	override name = "DeliveryError";
	readonly inbox: string;
	/** The inbox's last answer, or `null` when none arrived. */
	readonly status: number | null;
	/** Milliseconds the inbox asked to wait through `Retry-After`, or `null` when it named none. */
	readonly retryAfter: number | null;

	/**
	 * `retryable` follows from the code: rate limits, server errors, deadlines, dropped
	 * connections and an unavailable key store.
	 *
	 * @param code - Why the delivery failed.
	 * @param inbox - The inbox it was addressed to.
	 * @param message - The explanation a log shows.
	 * @param options - The status, the requested wait, and the underlying error.
	 */
	constructor(
		code: DeliveryErrorCode,
		inbox: string,
		message: string,
		options: DeliveryError.Options = {},
	) {
		super(code, message, { retryable: RETRYABLE_CODES.has(code), cause: options.cause });
		this.inbox = inbox;
		this.status = options.status ?? null;
		this.retryAfter = options.retryAfter ?? null;
	}
}

export namespace DeliveryError {
	/** What a delivery failure carries beyond its code. */
	export interface Options {
		status?: number | null;
		retryAfter?: number | null;
		cause?: unknown;
	}
}

/** One delivery: a serialized activity, the inbox it goes to, and the local actor who signs it. */
export interface DeliveryInput {
	/** The local actor whose keys sign the POST. */
	actor: string;
	/** The activity as JSON text, POSTed byte for byte. */
	activity: string;
	inbox: string;
}

/** What `deliver` needs. */
export interface DeliverOptions {
	/** The signing keys of `input.actor`. */
	keys: KeyProvider;
	/** Keeps each origin's accepted scheme and its failure window; a failing cache costs a knock. */
	cache: Cache;
	/** Sent on every POST; some instances refuse requests without one. */
	userAgent: string;
	/** The deadline of each POST, the second knock getting its own. @default "15 seconds" */
	timeout?: DurationInput;
	/** The signing time and the clock `Retry-After` dates are read against. @default () => new Date() */
	now?: () => Date;
}

/** A delivery the inbox accepted. */
export interface Delivered {
	/** The `2xx` the inbox answered. */
	status: number;
	/** The scheme the accepted POST was signed with, which the origin is now remembered for. */
	scheme: Scheme;
}

/** A signature an inbox asked for through `Accept-Signature`, under the label it chose. */
interface Requested extends AcceptSignature {
	label: string;
}

/** One knock: the scheme and, for an `Accept-Signature` request, what to cover. */
interface Knock {
	scheme: Scheme;
	requested: Requested | null;
}

/**
 * Signs and POSTs `input.activity` to `input.inbox`. Each POST is signed when it is sent,
 * so `Date` is fresh on a retry, and is sent once with `redirect: "manual"`. A `400`, `401`
 * or `403` is retried at once with the other scheme, and a `401` with `Accept-Signature` is
 * honored once with the components it asks for; the scheme that lands is remembered per
 * origin for 30 days. A retryable failure starts or extends the origin's failure window.
 *
 * @param input - The activity, the inbox and the signing actor.
 * @param options - The keys, the cache, the `User-Agent`, the deadline and the clock.
 * @returns The status and scheme, or a `DeliveryError` saying whether to retry.
 * @example let sent = await deliver(ctx.input, { keys, cache, userAgent: USER_AGENT });
 */
export async function deliver(
	input: DeliveryInput,
	options: DeliverOptions,
): Promise<Result<Delivered, DeliveryError>> {
	let now = options.now ?? (() => new Date());
	let timeout = toMs(options.timeout ?? DEFAULT_TIMEOUT);
	let inbox = input.inbox;

	let checked = checkUrl(inbox);
	if (isFailure(checked)) {
		return failure(
			new DeliveryError("refused-url", inbox, checked.error.message, { cause: checked.error }),
		);
	}
	let url = checked.data;
	let origin = url.origin;

	let resolved = await resolveHost(url, { signal: AbortSignal.timeout(timeout) });
	if (isFailure(resolved)) {
		let code = resolved.error.code;
		if (code !== "timeout" && code !== "network") {
			return failure(
				new DeliveryError("refused-url", inbox, resolved.error.message, { cause: resolved.error }),
			);
		}
		return failed(
			options.cache,
			origin,
			now,
			new DeliveryError(code, inbox, resolved.error.message, { cause: resolved.error }),
		);
	}

	let keys = await options.keys.keysOf(input.actor);
	if (isFailure(keys)) {
		return failure(
			new DeliveryError(
				"keys-unavailable",
				inbox,
				`Could not read the keys of ${input.actor}: ${keys.error.message}`,
				{ cause: keys.error },
			),
		);
	}
	if (keys.data === null) {
		return failure(
			new DeliveryError("missing-keys", inbox, `${input.actor} has no signing keys here`),
		);
	}

	let body = new TextEncoder().encode(input.activity);
	let remembered = await rememberedScheme(options.cache, origin);
	let knocks: Knock[] = orderFor(remembered).map((scheme) => ({ scheme, requested: null }));
	let honored = false;
	let last: { response: Response; scheme: Scheme } | null = null;
	let signingError: Error | null = null;

	for (let index = 0; index < knocks.length; index++) {
		let knock = knocks[index];
		if (knock === undefined) break;
		let signed = await signFor(url, body, keys.data, knock, options.userAgent, now());
		if (isFailure(signed)) {
			signingError = signed.error;
			continue;
		}

		let sent = await post(signed.data, body, timeout);
		if (isFailure(sent)) return failed(options.cache, origin, now, sent.error);

		if (last !== null) release(last.response.body);
		last = { response: sent.data, scheme: knock.scheme };
		if (!REFUSED_STATUSES.has(sent.data.status)) break;

		if (sent.data.status === 401 && !honored) {
			let requested = acceptSignatureOf(sent.data);
			if (requested !== null) {
				honored = true;
				knocks.splice(index + 1, 0, { scheme: "rfc9421", requested });
			}
		}
	}

	if (last === null) {
		return failure(
			new DeliveryError("unsignable", inbox, `Could not sign for ${inbox}`, {
				cause: signingError,
			}),
		);
	}

	let { response, scheme } = last;
	release(response.body);
	let status = response.status;

	if (status >= 200 && status < 300) {
		await recordSuccess(options.cache, origin).catch(() => undefined);
		if (remembered !== scheme) {
			await options.cache
				.write(schemeKey(origin), scheme, { ttl: SCHEME_TTL })
				.catch(() => undefined);
		}
		return success({ status, scheme });
	}

	let error = errorFor(inbox, response, now());
	if (error.retryable) return failed(options.cache, origin, now, error);
	return failure(error);
}

/**
 * Starts or extends the origin's failure window, then answers the failure. A cache error
 * leaves the window as it was.
 */
async function failed(
	cache: Cache,
	origin: string,
	now: () => Date,
	error: DeliveryError,
): Promise<Result<Delivered, DeliveryError>> {
	await recordFailure(cache, origin, now().getTime()).catch(() => undefined);
	return failure(error);
}

/** The cache entry of an origin's accepted scheme. */
function schemeKey(origin: string): string {
	return `activitypub:scheme:${origin}`;
}

/** The scheme `origin` last accepted, or `null` when none is remembered or the cache fails. */
async function rememberedScheme(cache: Cache, origin: string): Promise<Scheme | null> {
	let read = await cache.read<string>(schemeKey(origin)).catch(() => null);
	if (read === null || !isSuccess(read)) return null;
	return read.data === "rfc9421" || read.data === "draft-cavage" ? read.data : null;
}

/** The remembered scheme first, then the other; RFC 9421 first for an origin never reached. */
function orderFor(remembered: Scheme | null): Scheme[] {
	if (remembered === null) return [...DEFAULT_ORDER];
	return [remembered, ...DEFAULT_ORDER.filter((scheme) => scheme !== remembered)];
}

/**
 * Builds and signs one POST. A knock answering `Accept-Signature` covers what was asked,
 * under the asked label, nonce and tag, and with an `expires` when one was asked.
 */
async function signFor(
	url: URL,
	body: Uint8Array<ArrayBuffer>,
	keys: ActorKeys,
	knock: Knock,
	userAgent: string,
	created: Date,
): Promise<Result<Request, Error>> {
	let request = new Request(url, {
		method: "POST",
		headers: {
			accept: ACTIVITY_ACCEPT,
			"content-type": ACTIVITY_JSON,
			"user-agent": userAgent,
		},
	});
	let signOptions: SignOptions = {
		scheme: knock.scheme,
		key: { id: keys.rsa.id, privateKey: keys.rsa.privateKey },
		body,
		created,
	};
	let requested = knock.requested;
	if (requested !== null) {
		signOptions.components = withRequired(requested.components);
		signOptions.label = requested.label;
		if (requested.params.nonce !== undefined) signOptions.nonce = requested.params.nonce;
		if (requested.params.tag !== undefined) signOptions.tag = requested.params.tag;
		if (requested.params.expires === true) {
			signOptions.expires = new Date(created.getTime() + REQUESTED_EXPIRY_MS);
		}
	}
	return sign(request, signOptions);
}

/**
 * The components an inbox asked for, followed by each required one it left out. Only the
 * whole field counts as covering `content-digest`, never one member of it.
 *
 * @param requested - The components `Accept-Signature` named.
 */
function withRequired(requested: Component[]): Component[] {
	let missing = REQUIRED_COMPONENTS.filter(
		(name) => !requested.some((component) => component.name === name && !component.params),
	);
	return [...requested, ...missing.map((name) => ({ name }))];
}

/**
 * Sends one signed POST within its own deadline. Redirects come back as the answer, since
 * a body is never replayed to a URL nobody checked.
 */
async function post(
	request: Request,
	body: Uint8Array<ArrayBuffer>,
	timeout: number,
): Promise<Result<Response, DeliveryError>> {
	try {
		return success(
			await fetch(request.url, {
				method: "POST",
				headers: [...request.headers],
				body,
				redirect: "manual",
				credentials: "omit",
				signal: AbortSignal.timeout(timeout),
			}),
		);
	} catch (cause) {
		let timedOut =
			typeof cause === "object" &&
			cause !== null &&
			"name" in cause &&
			cause.name === "TimeoutError";
		let reason = cause instanceof Error ? cause.message : String(cause);
		return failure(
			timedOut
				? new DeliveryError("timeout", request.url, `${request.url} did not answer in time`, {
						cause,
					})
				: new DeliveryError("network", request.url, `Could not reach ${request.url}: ${reason}`, {
						cause,
					}),
		);
	}
}

/**
 * The first signature a `401` asks for through `Accept-Signature` (RFC 9421 §5), or `null`
 * when it asks for none or the field cannot be read.
 */
function acceptSignatureOf(response: Response): Requested | null {
	let text = response.headers.get("accept-signature");
	if (text === null) return null;
	let parsed = parseAcceptSignature(text);
	if (isFailure(parsed)) return null;
	let first = Object.entries(parsed.data)[0];
	if (first === undefined) return null;
	return { label: first[0], ...first[1] };
}

/** The failure a non-`2xx` final answer maps to, per the delivery outcomes table. */
function errorFor(inbox: string, response: Response, now: Date): DeliveryError {
	let status = response.status;
	let options = { status };
	if (status === 410) return new DeliveryError("gone", inbox, `${inbox} is gone`, options);
	if (status === 401 || status === 403) {
		return new DeliveryError(
			"unauthorized",
			inbox,
			`${inbox} refused every signature with ${status}`,
			options,
		);
	}
	if (status === 429) {
		return new DeliveryError("rate-limited", inbox, `${inbox} is rate limiting`, {
			status,
			retryAfter: parseRetryAfter(response.headers.get("retry-after"), now),
		});
	}
	if (status >= 500) {
		return new DeliveryError("server", inbox, `${inbox} answered ${status}`, {
			status,
			retryAfter: parseRetryAfter(response.headers.get("retry-after"), now),
		});
	}
	return new DeliveryError(
		"rejected",
		inbox,
		`${inbox} rejected the activity with ${status}`,
		options,
	);
}

/**
 * Reads `Retry-After` as milliseconds from `now`: delay-seconds or an HTTP date, clamped to
 * `0` through `MAX_RETRY_AFTER_MS`, so an inbox can postpone a retry no longer than the
 * longest backoff step. Anything else reads as `null`.
 *
 * @param value - The header value.
 * @param now - The time the answer arrived.
 */
export function parseRetryAfter(value: string | null, now: Date): number | null {
	if (value === null) return null;
	let text = value.trim();
	let delay = /^-?\d+$/u.test(text) ? Number(text) * 1000 : Date.parse(text) - now.getTime();
	if (Number.isNaN(delay)) return null;
	return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, delay));
}
