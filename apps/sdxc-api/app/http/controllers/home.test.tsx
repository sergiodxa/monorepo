/**
 * Landing page: HTML for browsers, Markdown when preferred, brand and MCP facts present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { STYLESHEET_HREF } from "~/app/test/assets-manifest";
import { SITE_BRAND, SITE_ORIGIN } from "~/config/site";

describe("GET /", () => {
	let router: ReturnType<typeof createWebRouter>;

	beforeAll(() => {
		router = createWebRouter();
	});

	test("renders an HTML landing with brand, MCP and charging sections", async () => {
		let response = await router.fetch(
			new Request("https://api.sdxc.dev/", {
				headers: { accept: "text/html" },
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/text\/html/);
		let html = await response.text();
		expect(html).toContain(SITE_BRAND);
		expect(html).toContain("How charging works");
		expect(html).toContain("Connect over MCP");
		expect(html).toContain(`${SITE_ORIGIN}/mcp`);
		expect(html).toContain("semver.satisfies");
		expect(html).toContain("PAYMENT-REQUIRED");
		expect(html).toContain(STYLESHEET_HREF);
	});

	test("answers Markdown when Accept prefers it", async () => {
		let response = await router.fetch(
			new Request("https://api.sdxc.dev/", {
				headers: { accept: "text/markdown" },
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toMatch(/text\/markdown/);
		let body = await response.text();
		expect(body).toContain(`# ${SITE_BRAND}`);
		expect(body).toContain(`${SITE_ORIGIN}/mcp`);
		expect(body).toContain("x402");
		expect(body).toContain("semver.satisfies");
	});
});
