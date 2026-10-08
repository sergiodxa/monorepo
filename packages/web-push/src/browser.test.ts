// @vitest-environment happy-dom

/**
 * Drives `subscribe` against a stand-in service worker container, push manager and
 * permission API: reusing a subscription made under the same key, replacing one made
 * under another, and answering `denied` and `unsupported` without throwing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url } from "@sdxc/crypto";
import { isFailure, unwrap } from "@sdxc/result";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isSupported, subscribe } from "./browser.js";

/** The page's VAPID public key, from RFC 8291's example sender. */
const CURRENT_KEY =
	"BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";

/** A key the page used before a rotation. */
const OLD_KEY =
	"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";

/** A subscription as the stand-in push manager hands it out. */
interface FakeSubscription {
	endpoint: string;
	options: { applicationServerKey: ArrayBuffer | null };
	unsubscribe: ReturnType<typeof vi.fn>;
	getKey(name: string): ArrayBuffer;
	toJSON(): { endpoint: string; keys: Record<string, string> };
}

/** The bytes a base64url key spells, as the browser stores `applicationServerKey`. */
function keyBuffer(key: string): ArrayBuffer {
	return Uint8Array.from(unwrap(Base64Url.decode(key))).buffer;
}

/** A subscription made under `key`, at an endpoint named for it. */
function fakeSubscription(key: string, name: string): FakeSubscription {
	return {
		endpoint: `https://fcm.googleapis.com/fcm/send/${name}`,
		options: { applicationServerKey: keyBuffer(key) },
		unsubscribe: vi.fn(async () => true),
		getKey: (which) => new Uint8Array(which === "auth" ? 16 : 65).buffer,
		toJSON() {
			return { endpoint: this.endpoint, keys: { p256dh: `${name}-p256dh`, auth: `${name}-auth` } };
		},
	};
}

let existing: FakeSubscription | null = null;
let subscribeCalls: { applicationServerKey: Uint8Array }[] = [];
let register = vi.fn();
let requestPermission = vi.fn<() => Promise<NotificationPermission>>();

/** Installs the stand-ins with a permission state the test chooses. */
function installBrowser(permission: NotificationPermission): void {
	let pushManager = {
		getSubscription: async () => existing,
		subscribe: async (options: { applicationServerKey: Uint8Array }) => {
			subscribeCalls.push(options);
			return fakeSubscription(Base64Url.encode(options.applicationServerKey), "fresh");
		},
	};
	let registration = { pushManager };
	register = vi.fn(async () => registration);

	Object.defineProperty(navigator, "serviceWorker", {
		configurable: true,
		value: { register, ready: Promise.resolve(registration) },
	});
	vi.stubGlobal("PushManager", class {});
	vi.stubGlobal("Notification", { permission, requestPermission });
}

beforeEach(() => {
	existing = null;
	subscribeCalls = [];
	requestPermission = vi.fn(async () => "granted" as const);
});

afterEach(() => {
	vi.unstubAllGlobals();
	Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("isSupported", () => {
	test("is false without a service worker container", () => {
		expect(isSupported()).toBe(false);
	});

	test("is true with service workers, the Push API and notifications", () => {
		installBrowser("default");
		expect(isSupported()).toBe(true);
	});
});

describe("subscribe", () => {
	test("answers unsupported in a browser without the Push API", async () => {
		let result = await subscribe({ worker: "/sw.js", applicationServerKey: CURRENT_KEY });

		expect(isFailure(result) && result.error.code).toBe("unsupported");
	});

	test("asks for permission, registers the worker and subscribes under the page's key", async () => {
		installBrowser("default");

		let result = unwrap(
			await subscribe({ worker: "/sw.js", applicationServerKey: CURRENT_KEY, scope: "/" }),
		);

		expect(requestPermission).toHaveBeenCalledTimes(1);
		expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
		expect(Base64Url.encode(subscribeCalls[0]?.applicationServerKey ?? new Uint8Array())).toBe(
			CURRENT_KEY,
		);
		expect(result).toEqual({
			endpoint: "https://fcm.googleapis.com/fcm/send/fresh",
			keys: { p256dh: "fresh-p256dh", auth: "fresh-auth" },
			applicationServerKey: CURRENT_KEY,
		});
	});

	test("reuses a subscription made under the same key without prompting", async () => {
		installBrowser("granted");
		existing = fakeSubscription(CURRENT_KEY, "kept");

		let result = unwrap(await subscribe({ worker: "/sw.js", applicationServerKey: CURRENT_KEY }));

		expect(requestPermission).not.toHaveBeenCalled();
		expect(subscribeCalls).toHaveLength(0);
		expect(existing.unsubscribe).not.toHaveBeenCalled();
		expect(result.endpoint).toBe("https://fcm.googleapis.com/fcm/send/kept");
	});

	test("replaces a subscription made under another key", async () => {
		installBrowser("granted");
		let stale = fakeSubscription(OLD_KEY, "stale");
		existing = stale;

		let result = unwrap(await subscribe({ worker: "/sw.js", applicationServerKey: CURRENT_KEY }));

		expect(stale.unsubscribe).toHaveBeenCalledTimes(1);
		expect(subscribeCalls).toHaveLength(1);
		expect(result.endpoint).toBe("https://fcm.googleapis.com/fcm/send/fresh");
		expect(result.applicationServerKey).toBe(CURRENT_KEY);
	});

	test("answers denied when the permission was refused before, without prompting", async () => {
		installBrowser("denied");

		let result = await subscribe({ worker: "/sw.js", applicationServerKey: CURRENT_KEY });

		expect(isFailure(result) && result.error.code).toBe("denied");
		expect(requestPermission).not.toHaveBeenCalled();
		expect(register).not.toHaveBeenCalled();
	});

	test("answers denied when the prompt is dismissed", async () => {
		installBrowser("default");
		requestPermission.mockResolvedValue("default");

		let result = await subscribe({ worker: "/sw.js", applicationServerKey: CURRENT_KEY });

		expect(isFailure(result) && result.error.code).toBe("denied");
	});

	test("answers failed when registering the worker throws", async () => {
		installBrowser("granted");
		register.mockRejectedValue(new TypeError("Failed to register a ServiceWorker"));

		let result = await subscribe({ worker: "/sw.js", applicationServerKey: CURRENT_KEY });

		expect(isFailure(result) && result.error.code).toBe("failed");
	});
});
