/**
 * Tests for the router middleware: `ctx.securityHeaders` with its policy applied to the
 * response the chain returns, and route-level overrides for non-CSP headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { securityHeaders, securityHeadersOverride } from "./middleware.js";

import type { SecurityHeaders } from "./index.js";

const POLICY: SecurityHeaders.Policy = {
	strictTransportSecurity: { maxAge: 31536000 },
	referrerPolicy: "no-referrer",
	xFrameOptions: "DENY",
};

describe("securityHeaders", () => {
	test("applies the policy to the response", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", () => new Response("ok"));

		let response = await router.fetch("https://example.com/");

		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(response.headers.has("content-security-policy")).toBe(false);
	});

	test("keeps a header the response set for itself", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", () => new Response("ok", { headers: { "referrer-policy": "origin" } }));

		let response = await router.fetch("https://example.com/");

		expect(response.headers.get("referrer-policy")).toBe("origin");
	});

	test("skips HSTS on a plain HTTP request", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", () => new Response("ok"));

		let response = await router.fetch("http://localhost:3000/");

		expect(response.headers.has("strict-transport-security")).toBe(false);
	});

	test("decorates a response whose own headers are immutable", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", () => Response.redirect("https://example.com/next", 302));

		let response = await router.fetch("https://example.com/");

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe("https://example.com/next");
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
	});

	test("applies a patch the handler makes and exposes the patched policy", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", (ctx) => {
			ctx.securityHeaders.override({
				referrerPolicy: null,
				xFrameOptions: "SAMEORIGIN",
			});
			return Response.json(ctx.securityHeaders.policy);
		});

		let response = await router.fetch("https://example.com/");
		let policy = (await response.json()) as SecurityHeaders.Policy;

		expect(policy.referrerPolicy).toBeUndefined();
		expect(policy.xFrameOptions).toBe("SAMEORIGIN");
		expect(response.headers.has("referrer-policy")).toBe(false);
		expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
	});
});

describe("securityHeadersOverride", () => {
	test("patches the policy for the routes it guards only", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/embed", {
			middleware: [securityHeadersOverride({ xFrameOptions: null })],
			handler: () => new Response("embeddable"),
		});
		router.get("/", () => new Response("ok"));

		let embed = await router.fetch("https://example.com/embed");
		let home = await router.fetch("https://example.com/");

		expect(embed.headers.has("x-frame-options")).toBe(false);
		expect(home.headers.get("x-frame-options")).toBe("DENY");
	});

	test("passes through when securityHeaders is not installed", async () => {
		let router = createRouter();
		router.get("/", {
			middleware: [securityHeadersOverride({ referrerPolicy: "origin" })],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch("https://example.com/");

		expect(await response.text()).toBe("ok");
		expect(response.headers.has("referrer-policy")).toBe(false);
	});
});
