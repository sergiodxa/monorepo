/**
 * Drives the about page through the real router inside workerd: the designed page in each
 * language, chosen by `Accept-Language` or `?lang=`, and its Markdown twin, picked by
 * extension or by `Accept`.
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

/** Requests `path` through the web router. */
function fetchPage(path: string, init: RequestInit = {}) {
	let app = createWebRouter(environment());
	return app.fetch(new Request(new URL(path, ORIGIN), { redirect: "manual", ...init }));
}

describe("GET /about", () => {
	test("renders the English page with its portrait, sections and links", async () => {
		let response = await fetchPage("/about");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("vary")).toContain("Accept-Language");
		expect(html).toMatch(/<title[^>]*>About<\/title>/);
		expect(html).toContain('lang="en"');
		for (let heading of ["What I do now", "How I got here", "What I care about", "Work with me"]) {
			expect(html).toContain(heading);
		}
		expect(html).toContain('src="/.well-known/avatar"');
		expect(html).toContain('src="/press/sergio-xalambri-helmet.jpg"');
		expect(html).toContain("GeoCities");
		expect(html).toContain('href="/press?lang=en"');
		expect(html).toContain('href="/about?lang=es-AR"');
	});

	test("answers in Spanish for a Spanish browser or ?lang=es", async () => {
		let byHeader = await (
			await fetchPage("/about", { headers: { "accept-language": "es-PE" } })
		).text();
		let byQuery = await (await fetchPage("/about?lang=es")).text();

		for (let html of [byHeader, byQuery]) {
			expect(html).toMatch(/<title[^>]*>Sobre mí<\/title>/);
			expect(html).toContain("Cómo llegué hasta acá");
			expect(html).toContain('href="/press?lang=es-AR"');
		}
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/about", { headers: { accept: "text/markdown" } });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## How I got here");
	});
});

describe("GET /about.md", () => {
	test("writes the page as Markdown with absolute links to this site", async () => {
		let response = await fetchPage("/about.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toMatch(/^# About\n/);
		expect(body).toContain(`(${ORIGIN}/.well-known/avatar)`);
		expect(body).toContain(`[Open the press kit](${ORIGIN}/press?lang=en)`);
		expect(body).toContain("- **2017: ZEIT, now Vercel.**");
		expect(body).toContain("- **2021: Daffy.**");
	});

	test("writes the Spanish page for ?lang=es-AR", async () => {
		let body = await (await fetchPage("/about.md?lang=es-AR")).text();

		expect(body).toMatch(/^# Sobre mí\n/);
		expect(body).toContain("## Lo que me importa");
	});
});
