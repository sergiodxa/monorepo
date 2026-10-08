/**
 * The sender: configured once with its VAPID identity, it checks a subscription and the
 * options, encrypts, signs, and sends one `POST` to the push service, classifying the
 * answer into a `WebPushError` an app maps to what it does with the stored row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs, toSeconds } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";

import type { WebPushErrorCode } from "./error.js";
import type { CheckedSubscription, Subscription } from "./subscription.js";
import type { VapidKeyPair, VapidKeys } from "./vapid.js";

import { encrypt, MAX_PAYLOAD_BYTES } from "./encrypt.js";
import { WebPushError } from "./error.js";
import { sameKey } from "./keys.js";
import { checkSubscription } from "./subscription.js";
import { generateKeyPair, Vapid } from "./vapid.js";

/** How long a push service holds a message for an offline device when the caller names nothing. */
const DEFAULT_TTL: DurationInput = "4 weeks";

/** How long a send waits for the push service when the caller names nothing. */
const DEFAULT_TIMEOUT: DurationInput = "10 seconds";

/** The longest `Topic` RFC 8030 allows, in base64url characters. */
const MAX_TOPIC_LENGTH = 32;

/** Milliseconds in a second, for `Retry-After`. */
const SECOND_MS = 1000;

/**
 * RFC 8030 urgency, which lets a device on battery or a metered network defer the
 * lower levels until it wakes for something else.
 */
export type Urgency = "very-low" | "low" | "normal" | "high";

/** A notification's body: UTF-8 text, raw bytes, or nothing for a push the worker answers by fetching. */
export type Payload = string | Uint8Array | undefined;

/** How a `WebPush` sender is configured. */
export interface WebPushOptions {
	/** The identity every send signs with, unless a subscription names another key. */
	vapid: VapidKeys;
	/**
	 * Identities rotated out, kept so a subscription made under one still signs with it
	 * until its browser subscribes again under `vapid`.
	 */
	previous?: readonly VapidKeys[];
	/**
	 * Hosts an endpoint must be on, where `*.` matches any subdomain; `PUSH_SERVICE_HOSTS`
	 * lists the major browsers'. Without it, any public `https:` host is accepted.
	 */
	allowedHosts?: readonly string[];
}

/** Per-message options. */
export interface PushOptions {
	/**
	 * How long the push service holds the message for an offline device; `0` delivers
	 * only to a device that is connected now.
	 *
	 * @default "4 weeks"
	 */
	ttl?: DurationInput;
	/** @default "normal" */
	urgency?: Urgency;
	/**
	 * Replaces an undelivered message with the same topic, so an offline device receives
	 * only the latest. At most 32 base64url characters.
	 */
	topic?: string;
	/**
	 * Zero bytes added inside the record, so the ciphertext length says less about the payload.
	 *
	 * @default 0
	 */
	padding?: number;
	/** @default "10 seconds" */
	timeout?: DurationInput;
	signal?: AbortSignal;
}

/** What a push service answered when it took the message. */
export interface Pushed {
	/** `201` from most services, `200` or `202` from some. */
	status: number;
}

/** The options after checking, in the units the headers carry. */
interface CheckedOptions {
	ttl: number;
	urgency: Urgency;
	topic: string | null;
	padding: number;
}

/**
 * Checks per-message options, so a bad topic or TTL fails before any request.
 *
 * @param options - The options as the caller passed them.
 * @param host - The endpoint's host, for the error.
 */
function checkOptions(options: PushOptions, host: string): Result<CheckedOptions, WebPushError> {
	let refuse = (why: string) =>
		failure(
			new WebPushError(`Refused the push options: ${why}`, { code: "invalid-options", host }),
		);

	let ttl = toSeconds(options.ttl ?? DEFAULT_TTL);
	if (!Number.isFinite(ttl) || ttl < 0) return refuse("ttl is not a non-negative duration");

	let topic = options.topic ?? null;
	if (topic !== null && !/^[\w-]{1,32}$/u.test(topic)) {
		return refuse(`topic is not 1 to ${MAX_TOPIC_LENGTH} base64url characters`);
	}

	let padding = options.padding ?? 0;
	if (!Number.isInteger(padding) || padding < 0 || padding > MAX_PAYLOAD_BYTES) {
		return refuse(`padding is not a whole number of bytes up to ${MAX_PAYLOAD_BYTES}`);
	}

	return success({ ttl, urgency: options.urgency ?? "normal", topic, padding });
}

/** Encodes a payload into the bytes that are encrypted, or `null` for a push with no body. */
function payloadBytes(payload: Payload): Uint8Array | null {
	if (payload === undefined) return null;
	return typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
}

/**
 * Reads `Retry-After` as seconds or an HTTP date.
 *
 * @param headers - The push service's response headers.
 * @returns Milliseconds to wait, or `null` when the service named no delay.
 */
function retryAfter(headers: Headers): number | null {
	let header = headers.get("retry-after");
	if (header === null || header.trim() === "") return null;

	let seconds = Number(header);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * SECOND_MS);

	let date = Date.parse(header);
	return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

/**
 * What a push service's status means. A redirect is never followed, since a push service
 * does not redirect and the endpoint came from a browser; `401`/`403` is the sender's
 * credential, never the device's.
 *
 * @param response - The push service's answer, or the opaque redirect a browser's `fetch` answers.
 */
function statusCode(response: Response): WebPushErrorCode | null {
	let { status } = response;
	if (response.type === "opaqueredirect") return "rejected";
	if (status >= 200 && status < 300) return null;
	if (status === 404 || status === 410) return "gone";
	if (status === 401 || status === 403) return "unauthorized";
	if (status === 429) return "rate-limited";
	if (status >= 500) return "unavailable";
	return "rejected";
}

/**
 * Whether a thrown value is a deadline's reason, which a `DOMException` carries by name.
 *
 * @param error - What `fetch` rejected with.
 */
function isTimeout(error: unknown): boolean {
	return (
		typeof error === "object" && error !== null && "name" in error && error.name === "TimeoutError"
	);
}

/**
 * Sends Web Push messages as one VAPID identity. Constructing it does no I/O; the keys
 * are imported and checked on the first send, and a token per push service origin is
 * cached for the instance's lifetime.
 *
 * @example let push = new WebPush({ vapid: { publicKey, privateKey, subject: "mailto:ops@example.com" } });
 * @example let sent = await push.send(subscription, JSON.stringify({ title: "Deploy finished" }));
 */
export class WebPush {
	#current: Vapid;
	#previous: Vapid[];
	#allowedHosts: readonly string[] | undefined;

	/** @param options - The identity, any rotated-out identities, and an endpoint allow list. */
	constructor(options: WebPushOptions) {
		this.#current = new Vapid(options.vapid);
		this.#previous = (options.previous ?? []).map((keys) => new Vapid(keys));
		this.#allowedHosts = options.allowedHosts;
	}

	/**
	 * Generates a VAPID pair. Run it once per deployment and keep the private key secret;
	 * changing the pair later needs `previous` to keep existing subscriptions working.
	 *
	 * @returns The public point and the private scalar, base64url.
	 * @example let { publicKey, privateKey } = await WebPush.generateKeys();
	 */
	static generateKeys(): Promise<VapidKeyPair> {
		return generateKeyPair();
	}

	/**
	 * Builds the `POST` that delivers one message to one device, for a caller that sends
	 * it through something other than the global `fetch`. It never follows a redirect.
	 *
	 * @param subscription - The device.
	 * @param payload - The body the service worker receives; omitted for none.
	 * @param options - TTL, urgency, topic and padding.
	 * @returns The request, or the `invalid-*` or `payload-too-large` failure that refused it.
	 */
	async request(
		subscription: Subscription,
		payload?: Payload,
		options: PushOptions = {},
	): Promise<Result<Request, WebPushError>> {
		let checked = checkSubscription(subscription, { allowedHosts: this.#allowedHosts });
		if (isFailure(checked)) return checked;

		let target = checked.data;
		let host = target.endpoint.host;

		let settings = checkOptions(options, host);
		if (isFailure(settings)) return settings;

		let bytes = payloadBytes(payload);
		if (bytes !== null && bytes.length + settings.data.padding > MAX_PAYLOAD_BYTES) {
			return failure(
				new WebPushError(
					`The payload is ${bytes.length + settings.data.padding} bytes; one record carries ${MAX_PAYLOAD_BYTES}`,
					{ code: "payload-too-large", host },
				),
			);
		}

		let vapid = this.#vapidFor(target);
		if (isFailure(vapid)) return vapid;

		let authorization = await vapid.data.authorization(target.endpoint.origin);
		if (isFailure(authorization)) return authorization;

		let headers = new Headers({
			Authorization: authorization.data,
			TTL: String(settings.data.ttl),
			Urgency: settings.data.urgency,
		});
		if (settings.data.topic !== null) headers.set("Topic", settings.data.topic);

		let body: Uint8Array<ArrayBuffer> | null = null;
		if (bytes !== null) {
			try {
				body = await encrypt({
					p256dh: target.p256dh,
					auth: target.auth,
					payload: bytes,
					padding: settings.data.padding,
				});
			} catch (error) {
				return failure(
					new WebPushError(`Could not encrypt for the subscription on ${host}`, {
						code: "invalid-subscription",
						host,
						cause: error,
					}),
				);
			}
			headers.set("Content-Encoding", "aes128gcm");
			headers.set("Content-Type", "application/octet-stream");
		}

		return success(
			new Request(target.endpoint, { method: "POST", headers, body, redirect: "manual" }),
		);
	}

	/**
	 * Sends one message to one device: `request` plus one `fetch` and the classification
	 * of the answer. One attempt only; retrying belongs to the caller's alarm or job.
	 *
	 * @param subscription - The device.
	 * @param payload - The body the service worker receives; omitted for none.
	 * @param options - TTL, urgency, topic, padding, timeout and signal.
	 * @returns The status the service took it with, or why it was refused or failed.
	 * @example if (isFailure(sent) && sent.error.code === "gone") await forget(row.id);
	 */
	async send(
		subscription: Subscription,
		payload?: Payload,
		options: PushOptions = {},
	): Promise<Result<Pushed, WebPushError>> {
		let request = await this.request(subscription, payload, options);
		if (isFailure(request)) return request;

		let host = new URL(request.data.url).host;
		let timeout = toMs(options.timeout ?? DEFAULT_TIMEOUT);
		let deadline = AbortSignal.timeout(Number.isFinite(timeout) ? timeout : toMs(DEFAULT_TIMEOUT));
		let signal = options.signal ? AbortSignal.any([deadline, options.signal]) : deadline;

		let response: Response;
		try {
			response = await fetch(request.data, { signal });
		} catch (error) {
			let timedOut = deadline.aborted || isTimeout(error);
			return failure(
				new WebPushError(
					timedOut ? `Timed out pushing to ${host}` : `Failed to reach the push service at ${host}`,
					{ code: timedOut ? "timeout" : "network", host, cause: error },
				),
			);
		}

		await response.body?.cancel().catch(() => undefined);

		let code = statusCode(response);
		if (code === null) return success({ status: response.status });

		return failure(
			new WebPushError(`The push service at ${host} answered ${response.status}`, {
				code,
				host,
				status: response.status,
				retryAfter: retryAfter(response.headers),
			}),
		);
	}

	/**
	 * The identity a subscription signs with: the one whose public key it subscribed
	 * under, or the current one when it names none.
	 *
	 * @param target - The checked subscription.
	 * @returns The identity, or `invalid-subscription` for a key this sender no longer holds.
	 */
	#vapidFor(target: CheckedSubscription): Result<Vapid, WebPushError> {
		let key = target.applicationServerKey;
		if (key === null) return success(this.#current);

		let match = [this.#current, ...this.#previous].find((vapid) =>
			sameKey(vapid.keys.publicKey, key),
		);
		if (match) return success(match);

		return failure(
			new WebPushError(
				`The subscription on ${target.endpoint.host} was made under a VAPID key this sender no longer holds`,
				{ code: "invalid-subscription", host: target.endpoint.host },
			),
		);
	}
}
