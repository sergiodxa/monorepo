/**
 * Tests device registration: a subscription a browser could have issued is stored, and
 * anything else answers `400` before the store is reached, since an endpoint stored here is
 * one the reader's object later signs and `POST`s to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Router } from "remix/router";

import { beforeEach, describe, expect, test, vi } from "vitest";

import type { UserStoreDouble } from "~/app/lib/test/store";

import { createTestRouter, ORIGIN, VIEWER } from "~/app/lib/test/controller";
import { createUserStoreDouble } from "~/app/lib/test/store";
import routes from "~/routes/web";

let store: UserStoreDouble = createUserStoreDouble();

vi.doMock("~/database/user-do", () => ({ userStore: () => store }));

let { default: devices } = await import("./devices");

/** The key the page handed the browser to subscribe under, from RFC 8291's example sender. */
const VAPID_KEY =
	"BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";

/** A subscription a browser hands over, with RFC 8291's example key material. */
const SUBSCRIPTION = {
	endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
	keys: {
		p256dh:
			"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
		auth: "BTBZMqHH6r4Tts7J_aSIgg",
	},
	applicationServerKey: VAPID_KEY,
};

/** A router with the registration route mapped, signed in as the test viewer. */
function createRouter(): Router {
	let router = createTestRouter(VIEWER);
	router.map(routes.notifications.devices, devices);
	return router;
}

/** Posts a registration body as the script on the settings page does. */
function register(subscription: Record<string, unknown>): Promise<Response> {
	return createRouter().fetch(
		new Request(new URL(routes.notifications.devices.href(), ORIGIN), {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ subscription, locale: "en" }),
		}),
	);
}

beforeEach(() => {
	store = createUserStoreDouble();
});

describe("POST /settings/notifications/devices", () => {
	test("stores a subscription a browser issued, with the key it subscribed under", async () => {
		let response = await register(SUBSCRIPTION);

		expect(response.status).toBe(200);
		expect(store.registerDevice).toHaveBeenCalledWith(
			expect.objectContaining({
				endpoint: SUBSCRIPTION.endpoint,
				p256dh: SUBSCRIPTION.keys.p256dh,
				auth: SUBSCRIPTION.keys.auth,
				vapidKey: VAPID_KEY,
				locale: "en",
			}),
		);
	});

	test.each([
		["a loopback address", "https://127.0.0.1/push"],
		["a private address", "https://10.0.0.1/push"],
		["the metadata address", "https://169.254.169.254/latest"],
		["an IPv4-mapped private address", "https://[::ffff:10.0.0.1]/push"],
		["a reserved name", "https://push.internal/send"],
		["a single-label host", "https://localhost/send"],
		["plain http", "http://fcm.googleapis.com/fcm/send/device-1"],
		["credentials in the URL", "https://user:pass@fcm.googleapis.com/fcm/send/device-1"],
		["a relative path", "/settings"],
		["a string that is no URL", "not a url"],
	])("refuses an endpoint on %s", async (_case, endpoint) => {
		let response = await register({ ...SUBSCRIPTION, endpoint });

		expect(response.status).toBe(400);
		expect(store.registerDevice).not.toHaveBeenCalled();
	});

	test.each([
		["text that is not base64url", { p256dh: "not base64url!" }],
		["a point that is too short", { p256dh: SUBSCRIPTION.keys.p256dh.slice(0, 40) }],
		[
			"a point without the uncompressed prefix",
			{ p256dh: `A${SUBSCRIPTION.keys.p256dh.slice(1)}` },
		],
		["a point off the curve", { p256dh: `${SUBSCRIPTION.keys.p256dh.slice(0, -2)}AA` }],
		["an auth secret that is too short", { auth: "BTBZMqHH6r4Tts7J" }],
		["an auth secret that is too long", { auth: `${SUBSCRIPTION.keys.auth}AAAA` }],
	])("refuses key material that is %s", async (_case, keys) => {
		let response = await register({ ...SUBSCRIPTION, keys: { ...SUBSCRIPTION.keys, ...keys } });

		expect(response.status).toBe(400);
		expect(store.registerDevice).not.toHaveBeenCalled();
	});
});
