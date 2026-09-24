/**
 * Tests for the router middleware: `ctx.securityHeaders` with its lazily generated nonce, the
 * policy applied to the response the chain returns, and route-level overrides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { securityHeaders, securityHeadersOverride } from "./middleware.js";

import type { SecurityHeaders } from "./index.js";

const POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["self"],
		scriptSrc: ["self", "nonce"],
		frameAncestors: ["none"],
	},
	strictTransportSecurity: { maxAge: 31536000 },
	referrerPolicy: "no-referrer",
};

describe("securityHeaders", () => {
	test("writes the nonce a handler read into the CSP", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", (ctx) => new Response(ctx.securityHeaders.nonce));

		let response = await router.fetch("https://example.com/");
		let nonce = await response.text();

		expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
		expect(response.headers.get("content-security-policy")).toBe(
			`default-src 'self'; script-src 'self' 'nonce-${nonce}'; frame-ancestors 'none'`,
		);
	});

	test("drops the nonce source from a response that never read it", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", () => new Response("ok"));

		let response = await router.fetch("https://example.com/");

		expect(response.headers.get("content-security-policy")).toBe(
			"default-src 'self'; script-src 'self'; frame-ancestors 'none'",
		);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});

	test("keeps one nonce per request and a fresh one for the next", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/", (ctx) => {
			let first = ctx.securityHeaders.nonce;
			return new Response(first === ctx.securityHeaders.nonce ? first : "changed");
		});

		let first = await (await router.fetch("https://example.com/")).text();
		let second = await (await router.fetch("https://example.com/")).text();

		expect(first).not.toBe("changed");
		expect(second).not.toBe(first);
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
				contentSecurityPolicy: { imgSrc: ["https:"] },
			});
			return Response.json(ctx.securityHeaders.policy);
		});

		let response = await router.fetch("https://example.com/");
		let policy = (await response.json()) as SecurityHeaders.Policy;

		expect(policy.referrerPolicy).toBeUndefined();
		expect(policy.contentSecurityPolicy?.imgSrc).toEqual(["https:"]);
		expect(response.headers.has("referrer-policy")).toBe(false);
		expect(response.headers.get("content-security-policy")).toContain("img-src https:");
	});
});

describe("securityHeadersOverride", () => {
	test("patches the policy for the routes it guards only", async () => {
		let router = createRouter({ middleware: [securityHeaders(POLICY)] });
		router.get("/embed", {
			middleware: [securityHeadersOverride({ contentSecurityPolicy: { frameAncestors: ["*"] } })],
			handler: () => new Response("embeddable"),
		});
		router.get("/", () => new Response("ok"));

		let embed = await router.fetch("https://example.com/embed");
		let home = await router.fetch("https://example.com/");

		expect(embed.headers.get("content-security-policy")).toContain("frame-ancestors *");
		expect(embed.headers.has("x-frame-options")).toBe(false);
		expect(home.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
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
