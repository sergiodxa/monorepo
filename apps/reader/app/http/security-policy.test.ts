/**
 * Checks the policy every response is read under, byte for byte as the app decided it, through
 * the middleware that applies it: each directive and header present, a response setting its own
 * policy keeping it, and the body the renderer produced reaching the reader unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { securityHeaders } from "@sdxc/security-headers/middleware";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { SECURITY_POLICY } from "~/app/http/security-policy";

/** Answers `response` through a router carrying only the policy middleware. */
async function decorated(response: () => Response): Promise<Response> {
	let router = createRouter({ middleware: [securityHeaders(SECURITY_POLICY)] });
	router.get("/", response);
	return router.fetch("https://reader.test/");
}

describe("the security policy", () => {
	test("writes the Content-Security-Policy the app decided on", async () => {
		let response = await decorated(() => new Response("<p>hi</p>"));

		expect(response.headers.get("content-security-policy")).toBe(
			[
				"default-src 'none'",
				"script-src 'self'",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self'",
				"font-src 'self'",
				"connect-src 'self'",
				"manifest-src 'self'",
				"media-src 'none'",
				"frame-src 'none'",
				"frame-ancestors 'none'",
				"form-action 'self'",
				"base-uri 'none'",
				"object-src 'none'",
			].join("; "),
		);
	});

	test("names no publisher's host in any directive", async () => {
		let response = await decorated(() => new Response("<p>hi</p>"));
		let policy = response.headers.get("content-security-policy") ?? "";

		expect(policy).not.toContain("https:");
		expect(policy).not.toContain("report-uri");
		expect(policy).not.toContain("'unsafe-eval'");
	});

	test("carries the rest of the header set on every response", async () => {
		let response = await decorated(() => new Response("<p>hi</p>"));

		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("strict-transport-security")).toBe(
			"max-age=63072000; includeSubDomains; preload",
		);
		expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
		expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
		expect(response.headers.get("permissions-policy")).toBe(
			"camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
		);
	});

	test("hands the body on exactly as the handler produced it", async () => {
		let response = await decorated(() => new Response("<p>hi</p>", { status: 404 }));

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("<p>hi</p>");
	});

	test("leaves a response that declared its own policy alone", async () => {
		let response = await decorated(
			() => new Response("<p>hi</p>", { headers: { "content-security-policy": "sandbox" } }),
		);

		expect(response.headers.get("content-security-policy")).toBe("sandbox");
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
	});

	test("sends a proxied image's nosniff and resource policy through the middleware", async () => {
		let response = await decorated(
			() => new Response("", { headers: { "content-type": "image/png" } }),
		);

		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
	});
});
