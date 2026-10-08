/**
 * The subscription a browser hands over, and the checks it passes before it is stored or
 * sent to: an endpoint on a public `https:` host, a P-256 point on the curve, and a 16-byte
 * auth secret. Registration and `send` apply the same rule, so a stored row is sendable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { checkUrl } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";

import { WebPushError } from "./error.js";
import { decodeBase64Url, decodePoint } from "./keys.js";

/** Bytes of the auth secret RFC 8291 has the user agent generate. */
const AUTH_SECRET_LENGTH = 16;

/**
 * The hosts of the push services the major browsers subscribe through. A leading `*.`
 * matches any subdomain. Pass it as `allowedHosts` to refuse every other endpoint.
 */
export const PUSH_SERVICE_HOSTS: readonly string[] = [
	"fcm.googleapis.com",
	"updates.push.services.mozilla.com",
	"web.push.apple.com",
	"*.notify.windows.com",
];

/** The keys a payload is encrypted under, as `PushSubscription.toJSON()` writes them. */
export interface SubscriptionKeys {
	/** The browser's P-256 public key, base64url. */
	p256dh: string;
	/** The browser's 16-byte auth secret, base64url. */
	auth: string;
}

/**
 * One device, shaped like `PushSubscription.toJSON()` so the browser's own JSON is valid
 * input; `expirationTime` is ignored.
 *
 * @example let subscription: Subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
 */
export interface Subscription {
	endpoint: string;
	keys: SubscriptionKeys;
	/**
	 * The VAPID public key the browser subscribed with, which picks the pair a send signs
	 * with after a rotation. Absent means the current pair.
	 */
	applicationServerKey?: string | undefined;
}

/** Which endpoints a subscription may name. */
export interface SubscriptionPolicy {
	/**
	 * Hosts an endpoint must be on, where `*.` matches any subdomain. Without it, any
	 * public `https:` host is accepted, so a new browser vendor's push service works.
	 */
	allowedHosts?: readonly string[] | undefined;
}

/** A subscription whose every field passed, decoded into what encryption imports. */
export interface CheckedSubscription {
	endpoint: URL;
	p256dh: Uint8Array<ArrayBuffer>;
	auth: Uint8Array<ArrayBuffer>;
	applicationServerKey: string | null;
}

/**
 * Whether a host is one the allow list names, exactly or under a `*.` wildcard.
 *
 * @param host - The endpoint's hostname.
 * @param allowed - The allow list.
 */
function isAllowedHost(host: string, allowed: readonly string[]): boolean {
	let name = host.toLowerCase();
	return allowed.some((entry) => {
		let pattern = entry.toLowerCase();
		return pattern.startsWith("*.") ? name.endsWith(pattern.slice(1)) : name === pattern;
	});
}

/**
 * Parses an endpoint and refuses it unless it is `https:`, carries no credentials, names
 * a public host, and, when the policy has one, a host on the allow list.
 *
 * @param endpoint - The endpoint as a browser reported it.
 * @param policy - The allow list, when there is one.
 * @returns The parsed URL, or `null` when any rule refuses it.
 */
function checkEndpoint(endpoint: string, policy: SubscriptionPolicy): URL | null {
	let checked = checkUrl(endpoint);
	if (isFailure(checked) || checked.data.protocol !== "https:") return null;
	if (policy.allowedHosts && !isAllowedHost(checked.data.hostname, policy.allowedHosts)) {
		return null;
	}
	return checked.data;
}

/**
 * Decodes an auth secret, answering `null` unless it is exactly 16 bytes.
 *
 * @param value - The secret, base64url.
 */
function decodeAuth(value: string): Uint8Array<ArrayBuffer> | null {
	let bytes = decodeBase64Url(value);
	return bytes !== null && bytes.length === AUTH_SECRET_LENGTH ? bytes : null;
}

/** The host of an endpoint, or `null` when it does not parse. */
export function hostOf(endpoint: string): string | null {
	return URL.canParse(endpoint) ? new URL(endpoint).host : null;
}

/**
 * Checks every field of a subscription and decodes its keys, so a malformed row fails
 * `invalid-subscription` before any cryptography or request.
 *
 * @param subscription - The subscription as stored.
 * @param policy - The allow list, when there is one.
 * @returns The decoded subscription, or why it was refused.
 */
export function checkSubscription(
	subscription: Subscription,
	policy: SubscriptionPolicy = {},
): Result<CheckedSubscription, WebPushError> {
	let host = hostOf(subscription.endpoint);
	let refuse = (why: string) =>
		failure(
			new WebPushError(`Refused the subscription on ${host ?? "an unparsable endpoint"}: ${why}`, {
				code: "invalid-subscription",
				host,
			}),
		);

	let endpoint = checkEndpoint(subscription.endpoint, policy);
	if (endpoint === null) return refuse("the endpoint is not an allowed public https: URL");

	let p256dh = decodePoint(subscription.keys.p256dh);
	if (p256dh === null) return refuse("p256dh is not an uncompressed P-256 point");

	let auth = decodeAuth(subscription.keys.auth);
	if (auth === null) return refuse("auth is not a 16-byte secret");

	let applicationServerKey = subscription.applicationServerKey ?? null;
	if (applicationServerKey !== null && decodePoint(applicationServerKey) === null) {
		return refuse("applicationServerKey is not an uncompressed P-256 point");
	}

	return success({ endpoint, p256dh, auth, applicationServerKey });
}

/**
 * A schema for a registration route that applies the checks `send` applies, so a
 * subscription it accepts is one `send` will not refuse as `invalid-subscription`.
 *
 * @param policy - The allow list, when there is one.
 * @returns A schema whose output is a `Subscription`; unknown keys are dropped.
 * @example let schema = subscriptionSchema({ allowedHosts: PUSH_SERVICE_HOSTS });
 */
export function subscriptionSchema(
	policy: SubscriptionPolicy = {},
): s.Schema<unknown, Subscription> {
	return s.object({
		endpoint: s
			.string()
			.refine(
				(value) => checkEndpoint(value, policy) !== null,
				"Expected a public https: push endpoint",
			),
		keys: s.object({
			p256dh: s
				.string()
				.refine((value) => decodePoint(value) !== null, "Expected an uncompressed P-256 point"),
			auth: s
				.string()
				.refine((value) => decodeAuth(value) !== null, "Expected a 16-byte auth secret"),
		}),
		applicationServerKey: s.optional(
			s
				.string()
				.refine((value) => decodePoint(value) !== null, "Expected an uncompressed P-256 point"),
		),
	});
}

/**
 * The registration schema with no allow list: any public `https:` endpoint.
 *
 * @example let parsed = await validate(request, s.object({ subscription: SUBSCRIPTION_SCHEMA }));
 */
export const SUBSCRIPTION_SCHEMA: s.Schema<unknown, Subscription> = subscriptionSchema();
