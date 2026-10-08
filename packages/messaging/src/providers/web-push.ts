/**
 * The browser push destination: renders a message as a small JSON payload the app's
 * service worker draws, and sends it to one browser subscription through `@sdxc/web-push`.
 * A push cannot be edited or threaded, so a send is all it does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { Subscription, Urgency, WebPush, WebPushError } from "@sdxc/web-push";

import { Base64Url, sha256 } from "@sdxc/crypto";
import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";
import { MAX_PAYLOAD_BYTES } from "@sdxc/web-push";

import type { Destination, SendOptions, Sent } from "../destination.js";
import type { MessagingErrorCode } from "../error.js";
import type { Message, Severity } from "../message.js";

import { MessagingError } from "../error.js";
import { severityOf } from "../severity.js";
import { fitText, plainText, writeText } from "../text.js";

/** The longest title drawn; a notification shows a line or two of it at most. */
const TITLE_LIMIT = 250;

/**
 * How many rounds the text is cut before it is dropped. Each round keeps the share of
 * the text its JSON bytes allow, so multi-byte text converges in a round or two.
 */
const MAX_FIT_ROUNDS = 8;

/** The longest key used as the `Topic` as written; a longer or unsafe one is hashed. */
const MAX_TOPIC_LENGTH = 32;

/** Urgency by severity, so a phone on battery holds an informational push and wakes for an outage. */
const URGENCY: Readonly<Record<Severity, Urgency>> = {
	info: "normal",
	success: "normal",
	warning: "normal",
	critical: "high",
};

/** What each `WebPushError` code means as a `MessagingError`, matched by name where they share one. */
const ERROR_CODES: Readonly<Record<WebPushError["code"], MessagingErrorCode>> = {
	"invalid-subscription": "invalid-destination",
	"invalid-vapid": "unauthorized",
	"invalid-options": "invalid-message",
	"payload-too-large": "invalid-message",
	gone: "gone",
	unauthorized: "unauthorized",
	rejected: "rejected",
	"rate-limited": "rate-limited",
	unavailable: "unavailable",
	timeout: "timeout",
	network: "network",
};

/** The JSON a service worker receives and draws as a notification. */
export interface BrowserPushPayload {
	title: string;
	/** The text and fields as plain text, cut so the whole payload fits one push. */
	body: string;
	/** The first link, which the worker opens when the notification is clicked. */
	url?: string;
	/** The message's `key`, so a resolved message replaces the open one on the lock screen. */
	tag?: string;
	severity: Severity;
	/** ISO 8601. */
	timestamp?: string;
}

/** How a `BrowserPush` destination is configured. */
export interface BrowserPushOptions {
	/** The sender, built once per batch so devices on one push service share one signature. */
	push: WebPush;
	/** The browser to notify. */
	subscription: Subscription;
	/**
	 * How long the push service holds the message for an offline browser.
	 *
	 * @default "4 weeks"
	 */
	ttl?: DurationInput;
}

/**
 * The payload's size as it is sent: UTF-8 bytes of its JSON.
 *
 * @param payload - The rendered payload.
 */
function payloadBytes(payload: BrowserPushPayload): number {
	return new TextEncoder().encode(JSON.stringify(payload)).length;
}

/**
 * The `Topic` a key is sent under: the key itself when it is short base64url, and
 * otherwise 32 characters of its SHA-256, so any key replaces its own earlier push.
 *
 * @param key - The message's key.
 * @returns The topic, or `undefined` when the digest is unavailable and the push goes untopiced.
 */
async function topicFor(key: string): Promise<string | undefined> {
	if (/^[\w-]+$/u.test(key) && key.length <= MAX_TOPIC_LENGTH) return key;
	let digest = await sha256(key);
	return isFailure(digest) ? undefined : Base64Url.encode(digest.data).slice(0, MAX_TOPIC_LENGTH);
}

/**
 * Sends a message to one browser. The service worker draws the payload `render`
 * answers, which the README shows a ten-line handler for.
 *
 * @example await new BrowserPush({ push, subscription }).send({ title: "api.example.com is down", severity: "critical" });
 */
export class BrowserPush implements Destination {
	readonly provider = "web-push";

	#push: WebPush;
	#subscription: Subscription;
	#ttl: DurationInput | undefined;

	/** @param options - The sender, the subscription and the TTL. */
	constructor(options: BrowserPushOptions) {
		this.#push = options.push;
		this.#subscription = options.subscription;
		this.#ttl = options.ttl;
	}

	/**
	 * The exact payload a send encrypts; a subclass overrides it to change the shape. The
	 * text is cut until the payload fits one push, fields kept, so a long text never fails
	 * the send; fields too long to fit with any text are dropped last.
	 *
	 * @param message - The message.
	 */
	render(message: Message): BrowserPushPayload {
		let fields = (message.fields ?? []).map((field) => `${field.label}: ${field.value}`);
		let text = message.text ? writeText(message.text, plainText) : "";
		let join = (lead: string, rest: string[]) =>
			[lead, ...rest].filter((part) => part !== "").join("\n");

		let payload: BrowserPushPayload = {
			title: fitText(message.title, TITLE_LIMIT),
			body: join(text, fields),
			severity: severityOf(message),
		};

		let first = message.links?.[0];
		if (first) payload.url = first.url;
		if (message.key !== undefined) payload.tag = message.key;
		if (message.timestamp) payload.timestamp = message.timestamp.toISOString();

		for (let round = 0; round < MAX_FIT_ROUNDS && text !== ""; round += 1) {
			let over = payloadBytes(payload) - MAX_PAYLOAD_BYTES;
			if (over <= 0) return payload;
			let textBytes = new TextEncoder().encode(JSON.stringify(text)).length;
			let keep = Math.floor((text.length * (textBytes - over)) / textBytes) - 1;
			text = fitText(text, Math.max(0, keep));
			payload.body = join(text, fields);
		}

		if (payloadBytes(payload) > MAX_PAYLOAD_BYTES) payload.body = "";
		return payload;
	}

	/**
	 * Sends the message. A push answers no message id, so the ref is always `null`.
	 *
	 * @param message - The message.
	 * @param options - Timeout and signal.
	 */
	async send(message: Message, options: SendOptions = {}): Promise<Result<Sent, MessagingError>> {
		let started = Date.now();
		let topic = message.key === undefined ? undefined : await topicFor(message.key);

		let sent = await this.#push.send(this.#subscription, JSON.stringify(this.render(message)), {
			urgency: URGENCY[severityOf(message)],
			...(this.#ttl === undefined ? {} : { ttl: this.#ttl }),
			...(topic === undefined ? {} : { topic }),
			...(options.timeout === undefined ? {} : { timeout: options.timeout }),
			...(options.signal === undefined ? {} : { signal: options.signal }),
		});

		currentLog()?.note("messaging.send", {
			provider: this.provider,
			outcome: isFailure(sent) ? ERROR_CODES[sent.error.code] : "sent",
			status: isFailure(sent) ? (sent.error.status ?? undefined) : sent.data.status,
			duration: Date.now() - started,
		});

		if (!isFailure(sent)) return success({ ref: null });

		let error = sent.error;
		return failure(
			new MessagingError(error.message, {
				code: ERROR_CODES[error.code],
				provider: this.provider,
				host: error.host,
				status: error.status,
				retryAfter: error.retryAfter,
				cause: error,
			}),
		);
	}
}
