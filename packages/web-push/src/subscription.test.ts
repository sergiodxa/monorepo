/**
 * Checks the registration schema: what a browser issues passes, and every endpoint or
 * key `send` would refuse fails here first, so a stored row is one `send` accepts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { PUSH_SERVICE_HOSTS, SUBSCRIPTION_SCHEMA, subscriptionSchema } from "./subscription.js";

/** What `PushSubscription.toJSON()` answers, with RFC 8291's example key material. */
const BROWSER_JSON = {
	endpoint: "https://fcm.googleapis.com/fcm/send/device-1",
	expirationTime: null,
	keys: {
		p256dh:
			"BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
		auth: "BTBZMqHH6r4Tts7J_aSIgg",
	},
};

describe("SUBSCRIPTION_SCHEMA", () => {
	test("accepts the browser's own JSON and drops expirationTime", () => {
		let parsed = s.parseSafe(SUBSCRIPTION_SCHEMA, BROWSER_JSON);

		expect(parsed.success && parsed.value).toEqual({
			endpoint: BROWSER_JSON.endpoint,
			keys: BROWSER_JSON.keys,
		});
	});

	test("keeps the key the browser subscribed under", () => {
		let applicationServerKey = BROWSER_JSON.keys.p256dh;

		let parsed = s.parseSafe(SUBSCRIPTION_SCHEMA, { ...BROWSER_JSON, applicationServerKey });

		expect(parsed.success && parsed.value.applicationServerKey).toBe(applicationServerKey);
	});

	test.each([
		["a loopback address", { endpoint: "https://127.0.0.1/push" }],
		["an IPv4-mapped private address", { endpoint: "https://[::ffff:10.0.0.1]/push" }],
		["a single-label host", { endpoint: "https://localhost/send" }],
		["plain http", { endpoint: "http://fcm.googleapis.com/fcm/send/device-1" }],
		["a relative path", { endpoint: "/settings" }],
		["text that is not base64url", { keys: { ...BROWSER_JSON.keys, p256dh: "not base64url!" } }],
		[
			"a point off the curve",
			{ keys: { ...BROWSER_JSON.keys, p256dh: `${BROWSER_JSON.keys.p256dh.slice(0, -2)}AA` } },
		],
		[
			"a long auth secret",
			{ keys: { ...BROWSER_JSON.keys, auth: `${BROWSER_JSON.keys.auth}AAAA` } },
		],
		["missing keys", { keys: undefined }],
		["an applicationServerKey that is no point", { applicationServerKey: "BAAA" }],
	])("refuses %s", (_case, override) => {
		expect(s.parseSafe(SUBSCRIPTION_SCHEMA, { ...BROWSER_JSON, ...override }).success).toBe(false);
	});
});

describe("subscriptionSchema with an allow list", () => {
	test("accepts the known push services and refuses any other host", () => {
		let schema = subscriptionSchema({ allowedHosts: PUSH_SERVICE_HOSTS });

		let windows = { ...BROWSER_JSON, endpoint: "https://db5p.notify.windows.com/w/?token=1" };
		let other = { ...BROWSER_JSON, endpoint: "https://push.example.com/send" };
		let lookalike = { ...BROWSER_JSON, endpoint: "https://evilnotify.windows.com/w" };

		expect(s.parseSafe(schema, BROWSER_JSON).success).toBe(true);
		expect(s.parseSafe(schema, windows).success).toBe(true);
		expect(s.parseSafe(schema, other).success).toBe(false);
		expect(s.parseSafe(schema, lookalike).success).toBe(false);
	});
});
