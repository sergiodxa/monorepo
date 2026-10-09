/**
 * The browser side of Web Push: subscribe this browser under the page's VAPID key and
 * answer the subscription a server stores. When to ask, what else to report and where to
 * post stay the app's, so these are plain functions for a client entry or a click handler.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { Base64Url } from "@sdxc/crypto/encoding";
import { failure, isFailure, success } from "@sdxc/result";

import type { Subscription } from "./subscription.js";

import { trimPadding } from "./keys.js";

/**
 * Why subscribing failed: `unsupported` for a browser without service workers or the
 * Push API, `denied` for a refused permission, `failed` for anything the browser threw.
 */
export type WebPushBrowserErrorCode = "unsupported" | "denied" | "failed";

/** Returned inside a `Failure` by `subscribe`, never thrown. */
export class WebPushBrowserError extends Error {
	override name = "WebPushBrowserError";

	readonly code: WebPushBrowserErrorCode;

	/**
	 * @param code - Why subscribing failed.
	 * @param message - What went wrong, for a log.
	 * @param options - The underlying error, when the browser threw one.
	 */
	constructor(code: WebPushBrowserErrorCode, message: string, options?: ErrorOptions) {
		super(message, options);
		this.code = code;
	}
}

/** Where the service worker lives and which key the browser subscribes under. */
export interface SubscribeOptions {
	/** The service worker script's URL, served from the origin it controls. */
	worker: string | URL;
	/** The sender's VAPID public key, base64url, as `WebPush` signs with it. */
	applicationServerKey: string;
	/** The worker's scope. @default the worker script's directory */
	scope?: string;
}

/** A subscription with the key it was made under, which a server stores beside it. */
export type BrowserSubscription = Subscription & { applicationServerKey: string };

/**
 * Whether this browser can subscribe at all. iOS and iPadOS answer `true` only inside a
 * web app added to the Home Screen.
 *
 * @example if (isSupported()) button.hidden = false;
 */
export function isSupported(): boolean {
	return (
		typeof navigator !== "undefined" &&
		"serviceWorker" in navigator &&
		"PushManager" in globalThis &&
		"Notification" in globalThis
	);
}

/** Encodes a key buffer as unpadded base64url, or `""` when the browser has none. */
function encodeKey(buffer: ArrayBuffer | null | undefined): string {
	return buffer ? Base64Url.encode(new Uint8Array(buffer)) : "";
}

/** Whether two key buffers hold the same bytes. */
function sameBytes(left: ArrayBuffer | null, right: Uint8Array): boolean {
	if (left === null || left.byteLength !== right.length) return false;
	let bytes = new Uint8Array(left);
	return bytes.every((byte, index) => byte === right[index]);
}

/**
 * Asks for notification permission unless it is already granted. Asked before anything
 * else is awaited, so the prompt runs inside the click that called `subscribe`.
 *
 * @returns Whether the page may show notifications.
 */
async function ensurePermission(): Promise<boolean> {
	if (Notification.permission === "granted") return true;
	if (Notification.permission === "denied") return false;
	return (await Notification.requestPermission()) === "granted";
}

/**
 * Subscribes this browser and answers the subscription to post to the server. An
 * existing subscription under the same key is reused; one under another key is replaced,
 * so a browser moves to a rotated key on its next call.
 *
 * Call it from a click or another user activation: Safari and Firefox refuse a
 * permission prompt requested without one.
 *
 * @param options - The worker, the VAPID public key and the scope.
 * @returns The subscription with its key, or why it could not be made.
 * @example let subscribed = await subscribe({ worker: "/sw.js", applicationServerKey });
 */
export async function subscribe(
	options: SubscribeOptions,
): Promise<Result<BrowserSubscription, WebPushBrowserError>> {
	if (!isSupported()) {
		return failure(new WebPushBrowserError("unsupported", "This browser cannot receive Web Push"));
	}

	let key = Base64Url.decode(trimPadding(options.applicationServerKey));
	if (isFailure(key)) {
		return failure(
			new WebPushBrowserError("failed", "The applicationServerKey is not base64url", {
				cause: key.error,
			}),
		);
	}
	let applicationServerKey = Uint8Array.from(key.data);

	try {
		if (!(await ensurePermission())) {
			return failure(new WebPushBrowserError("denied", "Notification permission was not granted"));
		}

		let registration = await navigator.serviceWorker.register(
			options.worker,
			options.scope === undefined ? undefined : { scope: options.scope },
		);
		await navigator.serviceWorker.ready;

		let existing = await registration.pushManager.getSubscription();
		if (existing && !sameBytes(existing.options.applicationServerKey, applicationServerKey)) {
			await existing.unsubscribe();
			existing = null;
		}

		let subscription =
			existing ??
			(await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }));

		let json = subscription.toJSON();
		return success({
			endpoint: subscription.endpoint,
			keys: {
				p256dh: json.keys?.["p256dh"] ?? encodeKey(subscription.getKey("p256dh")),
				auth: json.keys?.["auth"] ?? encodeKey(subscription.getKey("auth")),
			},
			applicationServerKey: Base64Url.encode(applicationServerKey),
		});
	} catch (error) {
		let refused = error instanceof DOMException && error.name === "NotAllowedError";
		return failure(
			new WebPushBrowserError(
				refused ? "denied" : "failed",
				refused ? "The browser refused to subscribe" : "Subscribing to Web Push failed",
				{ cause: error },
			),
		);
	}
}
