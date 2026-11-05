/**
 * Tests that `cspPatch` rewrites Remix CSP headers after the fact from handler patches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { csp } from "remix/middleware/csp";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { cspPatch, patchCsp } from "./csp-patch.js";

describe("cspPatch", () => {
	test("merges a report-only patch into the header Remix wrote", async () => {
		let router = createRouter({
			middleware: [
				cspPatch(),
				csp({
					reportOnlyPolicy: {
						defaultSrc: ["'self'"],
						frameSrc: ["'none'"],
					},
				}),
			],
		});
		router.get("/", (ctx) => {
			patchCsp(ctx, { reportOnlyPolicy: { frameSrc: ["https://rp.example"] } });
			return new Response("ok", { headers: { "content-type": "text/html" } });
		});

		let response = await router.fetch("https://example.com/");

		expect(response.headers.get("content-security-policy-report-only")).toBe(
			"default-src 'self'; frame-src https://rp.example",
		);
	});

	test("removes a header when the patch clears it", async () => {
		let router = createRouter({
			middleware: [
				cspPatch(),
				csp({
					policy: { defaultSrc: ["'none'"] },
				}),
			],
		});
		router.get("/", (ctx) => {
			patchCsp(ctx, { policy: null });
			return new Response("ok", { headers: { "content-type": "text/html" } });
		});

		let response = await router.fetch("https://example.com/");

		expect(response.headers.has("content-security-policy")).toBe(false);
	});

	test("leaves a non-HTML response alone when a patch was queued but Remix wrote no CSP", async () => {
		let router = createRouter({
			middleware: [
				cspPatch(),
				csp({
					reportOnlyPolicy: { defaultSrc: ["'self'"] },
				}),
			],
		});
		router.get("/health", (ctx) => {
			patchCsp(ctx, { reportOnlyPolicy: { scriptSrc: ["'self'", "sha256-abc"] } });
			return Response.json(
				{ status: "pass" },
				{ headers: { "Content-Type": "application/health+json" } },
			);
		});

		let response = await router.fetch("https://example.com/health");

		expect(response.headers.get("content-type")).toBe("application/health+json");
		expect(response.headers.has("content-security-policy-report-only")).toBe(false);
	});
});
