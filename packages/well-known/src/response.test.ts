/**
 * Checks what every well-known answer carries: the format's media type, the default
 * or given cache policy, an `ETag`, CORS for a CORS format, a 304 for a current copy,
 * and an empty body for `HEAD`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Jrd } from "./webfinger.js";

import { passkeyEndpoints } from "./passkey-endpoints.js";
import { respond } from "./response.js";
import { webFinger } from "./webfinger.js";

/** A small descriptor to serve. */
const JRD: Jrd = { subject: "acct:a@example.com", aliases: [], properties: {}, links: [] };

/** The passkey endpoints to serve. */
const ENDPOINTS = {
	enroll: new URL("https://example.com/passkeys/new"),
	manage: null,
	prfUsageDetails: null,
};

describe(respond, () => {
	test("answers with the media type, a public hour of caching and an ETag", async () => {
		let response = await respond(passkeyEndpoints, ENDPOINTS);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
		expect(response.headers.get("ETag")).toMatch(/^"[\w-]+"$/);
		expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
		expect(await response.json()).toEqual({ enroll: "https://example.com/passkeys/new" });
	});

	test("adds CORS for a format that requires it", async () => {
		let response = await respond(webFinger, JRD);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(response.headers.get("Content-Type")).toBe("application/jrd+json");
	});

	test("uses the given cache policy and lets extra headers override", async () => {
		let response = await respond(webFinger, JRD, {
			cache: { visibility: "public", maxAge: "5 minutes" },
			headers: { "X-Extra": "1", "Content-Type": "application/json" },
		});
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("X-Extra")).toBe("1");
		expect(response.headers.get("Content-Type")).toBe("application/json");
	});

	test("answers 304 when the request's If-None-Match still matches", async () => {
		let first = await respond(webFinger, JRD);
		let tag = first.headers.get("ETag") ?? "";
		let request = new Request("https://example.com/.well-known/webfinger", {
			headers: { "If-None-Match": tag },
		});
		let response = await respond(webFinger, JRD, { request });
		expect(response.status).toBe(304);
		expect(response.headers.get("ETag")).toBe(tag);
	});

	test("answers HEAD with the headers and no body", async () => {
		let request = new Request("https://example.com/.well-known/webfinger", { method: "HEAD" });
		let response = await respond(webFinger, JRD, { request });
		expect(response.status).toBe(200);
		expect(response.body).toBeNull();
		expect(response.headers.has("ETag")).toBe(true);
	});
});
