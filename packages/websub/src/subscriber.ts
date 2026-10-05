/**
 * The subscriber half of WebSub: asking a hub to subscribe or unsubscribe a callback, reading
 * and answering the hub's verification of intent, and proving a delivery came from the hub the
 * subscription shares a secret with. Storage, tokens and scheduling stay with the caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { hmac } from "@sdxc/crypto";
import { readBytes } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import { linkTarget } from "./lib/link-header.js";
import { absoluteUrl, formRequest, send } from "./lib/send.js";

import type { SignatureAlgorithm } from "./index.js";

import { WebSubRequestError, WebSubSignatureError, WebSubVerificationError } from "./index.js";

/** Every algorithm WebSub lets a hub sign with, accepted unless the caller narrows them. */
const ALL_ALGORITHMS: readonly SignatureAlgorithm[] = ["sha1", "sha256", "sha384", "sha512"];

/** The WebCrypto hash behind each algorithm name `X-Hub-Signature` uses. */
const WEBCRYPTO_HASH = {
	sha1: "SHA-1",
	sha256: "SHA-256",
	sha384: "SHA-384",
	sha512: "SHA-512",
} as const satisfies Record<SignatureAlgorithm, hmac.Hash>;

/** The largest delivery body read before it is refused. */
const DEFAULT_MAX_BYTES = 1_048_576;

/** WebSub §5.1.1 caps `hub.secret` below this many bytes. */
const SECRET_LIMIT_BYTES = 200;

/** The share of a granted lease that elapses before renewal, by default. */
const DEFAULT_RENEWAL_SHARE = 0.8;

/** The least notice a renewal gives before the lease runs out, by default: six hours. */
const DEFAULT_MINIMUM_LEAD_MS = 6 * 60 * 60 * 1000;

/** The status a hub answers an accepted subscription request with (§5.1.2). */
const ACCEPTED = 202;

/** A whole, non-negative number of seconds, as `hub.lease_seconds` carries it. */
const LEASE_PATTERN = /^\d+$/;

/** `X-Hub-Signature`'s `method=signature`, with a non-empty hex signature of even length. */
const SIGNATURE_PATTERN = /^([A-Za-z0-9-]+)=((?:[0-9A-Fa-f]{2})+)$/;

/** Types for the subscriber operations. */
export namespace Subscriber {
	/** What a subscription request sends to a hub. */
	export interface SubscribeOptions {
		/** The hub's URL; must be `https:`, because the request carries the secret. */
		hub: string;
		/** The publisher's `rel=self`, sent verbatim, since the hub keys the subscription by it. */
		topic: string;
		/** Where the hub verifies and delivers; unguessable when it identifies the subscription. */
		callback: string;
		/** Fewer than 200 bytes of UTF-8; required, so every delivery can be verified. */
		secret: string;
		/** The lease asked for, in seconds; the hub decides and reports the one granted. */
		leaseSeconds?: number;
		/** @default 10_000 */
		timeoutMs?: number;
	}

	/** What an unsubscription request sends to a hub. */
	export interface UnsubscribeOptions {
		/** The hub's URL; must be `https:`. */
		hub: string;
		topic: string;
		callback: string;
		/** @default 10_000 */
		timeoutMs?: number;
	}

	/** An unsubscription request, told apart from a subscription by its mode. */
	export interface UnsubscriptionRequestOptions extends UnsubscribeOptions {
		mode: "unsubscribe";
	}

	/** The hub confirming a subscription, with the lease it granted in seconds. */
	export interface SubscribeVerification {
		mode: "subscribe";
		topic: string;
		challenge: string;
		leaseSeconds: number;
	}

	/** The hub confirming an unsubscription. */
	export interface UnsubscribeVerification {
		mode: "unsubscribe";
		topic: string;
		challenge: string;
	}

	/** The hub refusing a subscription, or ending one it had granted (§5.2). */
	export interface Denial {
		mode: "denied";
		topic: string;
		reason: string | null;
	}

	/** What a hub's `GET` to the callback asks the subscriber to confirm or learn. */
	export type Verification = SubscribeVerification | UnsubscribeVerification | Denial;

	/** How a delivery is verified. */
	export interface VerifyDeliveryOptions {
		/** The algorithms a signature may use. @default ["sha1", "sha256", "sha384", "sha512"] */
		algorithms?: readonly SignatureAlgorithm[];
		/** The largest body read before the delivery is refused as too large. @default 1_048_576 */
		maxBytes?: number;
	}

	/** A delivery whose signature verified. */
	export interface Delivery {
		/** The bytes exactly as they arrived, which is what the signature covers. */
		body: Uint8Array;
		contentType: string | null;
		algorithm: SignatureAlgorithm;
		/** `rel=hub` from the delivery's `Link` header, which §7 requires the hub to send. */
		hub: string | null;
		/** `rel=self` from the delivery's `Link` header: the topic this content is for. */
		self: string | null;
	}

	/** The lease a renewal is computed from. */
	export interface RenewalOptions {
		/** Epoch milliseconds the verification was answered at. */
		verifiedAt: number;
		/** The lease the hub reported, which binds over the one requested. */
		leaseSeconds: number;
		/** The share of the lease to let elapse. @default 0.8 */
		share?: number;
		/** The least notice before expiry. @default 21_600_000 */
		minimumLeadMs?: number;
	}
}

/**
 * Builds the form POST a subscription or unsubscription sends, without sending it, for a caller
 * that queues or inspects it. A non-`https:` hub, a callback that is not an absolute URL, an
 * empty topic, a secret of 200 bytes or more, and a lease that is not a positive whole number
 * are refused here, so nothing that would be refused on the wire is ever sent.
 *
 * @param options - A subscription, or an unsubscription marked with `mode: "unsubscribe"`.
 * @returns The request to send to the hub.
 */
export function subscriptionRequest(
	options: Subscriber.SubscribeOptions | Subscriber.UnsubscriptionRequestOptions,
): Result<Request, WebSubRequestError> {
	let hub = absoluteUrl(options.hub, "hub");
	if (isFailure(hub)) return hub;
	if (hub.data.protocol !== "https:") {
		return failure(new WebSubRequestError(`The hub ${options.hub} must be reached over https:`));
	}

	let callback = absoluteUrl(options.callback, "callback");
	if (isFailure(callback)) return callback;

	if (options.topic === "") return failure(new WebSubRequestError("The topic is empty"));

	if ("mode" in options) {
		return success(
			formRequest(hub.data, [
				["hub.mode", "unsubscribe"],
				["hub.topic", options.topic],
				["hub.callback", options.callback],
			]),
		);
	}

	let secretBytes = new TextEncoder().encode(options.secret).byteLength;
	if (secretBytes === 0 || secretBytes >= SECRET_LIMIT_BYTES) {
		return failure(
			new WebSubRequestError(
				`The secret must be 1 to ${SECRET_LIMIT_BYTES - 1} bytes, got ${secretBytes}`,
			),
		);
	}

	let fields: [string, string][] = [
		["hub.mode", "subscribe"],
		["hub.topic", options.topic],
		["hub.callback", options.callback],
		["hub.secret", options.secret],
	];

	if (options.leaseSeconds !== undefined) {
		if (!Number.isInteger(options.leaseSeconds) || options.leaseSeconds <= 0) {
			return failure(
				new WebSubRequestError(`The lease ${options.leaseSeconds} is not a positive whole number`),
			);
		}
		fields.push(["hub.lease_seconds", String(options.leaseSeconds)]);
	}

	return success(formRequest(hub.data, fields));
}

/**
 * Asks a hub to subscribe a callback to a topic. Success means the hub answered `202 Accepted`
 * and will verify asynchronously; the subscription is live only once the callback acknowledges
 * that verification.
 *
 * @param options - The hub, topic, callback, secret and the lease to ask for.
 * @returns Nothing on acceptance, or why the request was refused or never answered.
 * @example let asked = await subscribe({ hub, topic, callback, secret, leaseSeconds: 864_000 });
 */
export async function subscribe(
	options: Subscriber.SubscribeOptions,
): Promise<Result<void, WebSubRequestError>> {
	let request = subscriptionRequest(options);
	if (isFailure(request)) return request;
	return send(request.data, (status) => status === ACCEPTED, options.timeoutMs);
}

/**
 * Asks a hub to stop delivering a topic to a callback. Success means the hub answered `202` and
 * will verify the unsubscription against the callback.
 *
 * @param options - The hub, topic and callback the subscription was made with.
 * @returns Nothing on acceptance, or why the request was refused or never answered.
 */
export async function unsubscribe(
	options: Subscriber.UnsubscribeOptions,
): Promise<Result<void, WebSubRequestError>> {
	let request = subscriptionRequest({ ...options, mode: "unsubscribe" });
	if (isFailure(request)) return request;
	return send(request.data, (status) => status === ACCEPTED, options.timeoutMs);
}

/**
 * Reads the `hub.*` query of the hub's `GET` to the callback. A subscribe verification without a
 * whole-number `hub.lease_seconds`, a verification without a topic or challenge, and an unknown
 * mode all fail, and a caller answers every failure with {@link refuse}.
 *
 * @param input - The verification request, or the URL it arrived on.
 * @returns What the hub asks the subscriber to confirm, or which field was wrong.
 */
export function parseVerification(
	input: URL | Request,
): Result<Subscriber.Verification, WebSubVerificationError> {
	let query = (input instanceof URL ? input : new URL(input.url)).searchParams;
	let mode = query.get("hub.mode");
	let topic = query.get("hub.topic");

	if (mode !== "subscribe" && mode !== "unsubscribe" && mode !== "denied") {
		return failure(new WebSubVerificationError(`Unknown hub.mode ${JSON.stringify(mode)}`));
	}

	if (!topic) return failure(new WebSubVerificationError("The verification has no hub.topic"));

	if (mode === "denied") return success({ mode, topic, reason: query.get("hub.reason") });

	let challenge = query.get("hub.challenge");
	if (!challenge) {
		return failure(new WebSubVerificationError("The verification has no hub.challenge"));
	}

	if (mode === "unsubscribe") return success({ mode, topic, challenge });

	let lease = query.get("hub.lease_seconds") ?? "";
	if (!LEASE_PATTERN.test(lease)) {
		return failure(
			new WebSubVerificationError(
				`hub.lease_seconds ${JSON.stringify(lease)} is not whole seconds`,
			),
		);
	}

	return success({ mode, topic, challenge, leaseSeconds: Number(lease) });
}

/**
 * Confirms a verification: `200 text/plain` with the challenge as the whole body, the only
 * answer WebSub counts as the subscriber meaning it.
 *
 * @param verification - The subscribe or unsubscribe verification being confirmed.
 */
export function acknowledge(
	verification: Subscriber.SubscribeVerification | Subscriber.UnsubscribeVerification,
): Response {
	return new Response(verification.challenge, {
		status: 200,
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
}

/** Answers `404` with an empty body: a verification this subscriber did not ask for. */
export function refuse(): Response {
	return new Response(null, { status: 404 });
}

/** Answers `410 Gone`, which tells the hub to drop a subscription this callback has ended. */
export function gone(): Response {
	return new Response(null, { status: 410 });
}

/**
 * Answers `202` with an empty body to a delivery, sent whether or not its signature verified,
 * so the response never tells a prober whether a guess at the secret was right.
 */
export function received(): Response {
	return new Response(null, { status: 202 });
}

/**
 * Checks a delivery's `X-Hub-Signature` over its body exactly as it arrived. The header is read
 * first, then at most `maxBytes` of body, then the MAC is compared in constant time. A delivery
 * with no signature is refused as `missing`, so every accepted delivery was signed.
 *
 * @param request - The hub's `POST` to the callback.
 * @param secret - The secret the subscription was made with.
 * @param options - The accepted algorithms and the body size cap.
 * @returns The verified body and its metadata, or which check refused it.
 * @example let delivery = await verifyDelivery(ctx.request, credentials.secret);
 */
export async function verifyDelivery(
	request: Request,
	secret: string,
	options: Subscriber.VerifyDeliveryOptions = {},
): Promise<Result<Subscriber.Delivery, WebSubSignatureError>> {
	let header = request.headers.get("x-hub-signature");
	if (header === null) {
		return failure(new WebSubSignatureError("The delivery carries no X-Hub-Signature", "missing"));
	}

	let parsed = SIGNATURE_PATTERN.exec(header.trim());
	if (parsed === null) {
		return failure(new WebSubSignatureError("X-Hub-Signature is not method=hex", "malformed"));
	}

	let [, method = "", signature = ""] = parsed;
	let algorithm = (options.algorithms ?? ALL_ALGORITHMS).find(
		(allowed) => allowed === method.toLowerCase(),
	);
	if (algorithm === undefined) {
		return failure(
			new WebSubSignatureError(`The signature algorithm ${method} is not accepted`, "algorithm"),
		);
	}

	let maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
	let read = await readBytes(request, { maxBytes });
	if (isFailure(read)) {
		if (read.error.code === "too-large") {
			return failure(
				new WebSubSignatureError(`The delivery exceeds ${maxBytes} bytes`, "too-large"),
			);
		}
		return failure(new WebSubSignatureError("The delivery body could not be read", "mismatch"));
	}

	let body = read.data.data;
	let verified = await hmac.verify(secret, body, signature, { hash: WEBCRYPTO_HASH[algorithm] });
	if (isFailure(verified) || !verified.data) {
		return failure(new WebSubSignatureError("The signature does not match the body", "mismatch"));
	}

	let links = request.headers.get("link");
	return success({
		body,
		contentType: request.headers.get("content-type"),
		algorithm,
		hub: linkTarget(links, "hub", request.url),
		self: linkTarget(links, "self", request.url),
	});
}

/**
 * The epoch milliseconds at which to resubscribe: once `share` of the granted lease has elapsed,
 * but no later than `minimumLeadMs` before it runs out. A lease too short to give that much
 * notice renews at its midpoint, so a short grant never turns into a renewal loop.
 *
 * @param options - When the lease was granted, its length, and the renewal policy.
 * @example let due = renewalAt({ verifiedAt: Date.now(), leaseSeconds: verification.leaseSeconds });
 */
export function renewalAt(options: Subscriber.RenewalOptions): number {
	let leaseMs = Math.max(0, options.leaseSeconds) * 1000;
	let share = options.share ?? DEFAULT_RENEWAL_SHARE;
	let minimumLead = options.minimumLeadMs ?? DEFAULT_MINIMUM_LEAD_MS;

	let lead = Math.max(leaseMs * (1 - share), Math.min(minimumLead, leaseMs / 2));
	return options.verifiedAt + leaseMs - lead;
}
