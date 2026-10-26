/**
 * Drives `/uses` through the real router inside workerd, against the local session KV: the
 * designed page in each language, its Markdown twin by extension and by `Accept`, and its
 * place in the sitemap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

const ORIGIN = "https://blog.test";

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		SUPPORT_RATE_LIMITER: env.SUPPORT_RATE_LIMITER,
		waitUntil: () => {},
	};
}

/** Requests `path` with `init` through a fresh router. */
function fetchPage(path: string, init: RequestInit = {}) {
	let app = createWebRouter(environment());
	return app.fetch(new Request(new URL(path, ORIGIN), { redirect: "manual", ...init }));
}

describe("GET /uses", () => {
	test("renders the English page with its sections, links and language switch", async () => {
		let response = await fetchPage("/uses");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Uses<\/title>/);
		expect(html).toContain('lang="en"');
		for (let heading of [
			"Hardware",
			"Editor and terminal",
			"Stack",
			"Hosting and services",
			"Apps",
		]) {
			expect(html).toContain(heading);
		}
		expect(html).toContain('href="https://cursor.com"');
		expect(html).toContain('href="#editor"');
		expect(html).toContain('href="/uses?lang=es-AR"');
		expect(html).toContain('href="/uses.md?lang=en"');
	});

	test("answers in Spanish for a Spanish browser or ?lang=es", async () => {
		let byHeader = await (
			await fetchPage("/uses", { headers: { "accept-language": "es-MX" } })
		).text();
		let byQuery = await (await fetchPage("/uses?lang=es")).text();

		for (let html of [byHeader, byQuery]) {
			expect(html).toMatch(/<title[^>]*>Lo que uso<\/title>/);
			expect(html).toContain('lang="es-AR"');
			expect(html).toContain("Hosting y servicios");
		}
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/uses", { headers: { accept: "text/markdown" } });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toMatch(/^# Uses\n/);
	});
});

describe("GET /uses.md", () => {
	test("writes each section as a list of linked items with their notes", async () => {
		let response = await fetchPage("/uses.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toMatch(/^# Uses\n/);
		expect(body).toContain("## Editor and terminal");
		expect(body).toContain("- [Bun](https://bun.sh): ");
	});

	test("writes the Spanish page for ?lang=es-AR", async () => {
		let body = await (await fetchPage("/uses.md?lang=es-AR")).text();

		expect(body).toMatch(/^# Lo que uso\n/);
		expect(body).toContain("## Editor y terminal");
	});
});
