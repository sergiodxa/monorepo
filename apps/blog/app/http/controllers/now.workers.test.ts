/**
 * Drives the now page through the real router inside workerd: the designed page in each
 * language with its update line and nownownow.com link, the Markdown it negotiates, and the
 * `.md` twin written from the same structured page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:test";
import { describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { NOW_UPDATED_AT } from "~/resources/content/now/shared";

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

/** Requests `path` through the real router. */
function fetchPage(path: string, init: RequestInit = {}) {
	return createWebRouter(environment()).fetch(new Request(new URL(path, ORIGIN), init));
}

describe("GET /now", () => {
	test("renders the English page with its update line, sections and nownownow.com link", async () => {
		let response = await fetchPage("/now");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Now<\/title>/);
		expect(html).toContain('lang="en"');
		expect(html).toContain("What I’m doing now");
		expect(html).toContain(`<time datetime="${NOW_UPDATED_AT}">`);
		for (let heading of ["Work", "Building", "Writing and speaking", "Open source"]) {
			expect(html).toContain(heading);
		}
		expect(html).toContain('href="https://nownownow.com/about"');
		expect(html).toContain('href="/now?lang=es-AR"');
	});

	test("answers in Spanish for a Spanish browser or ?lang=es", async () => {
		let byHeader = await (
			await fetchPage("/now", { headers: { "accept-language": "es-PE" } })
		).text();
		let byQuery = await (await fetchPage("/now?lang=es")).text();

		for (let html of [byHeader, byQuery]) {
			expect(html).toMatch(/<title[^>]*>Ahora<\/title>/);
			expect(html).toContain("Qué estoy haciendo ahora");
			expect(html).toContain("Actualizado el");
		}
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/now", { headers: { accept: "text/markdown" } });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toMatch(/^# What I’m doing now\n/);
	});
});

describe("GET /now.md", () => {
	test("writes the page as Markdown with the update line and absolute links", async () => {
		let response = await fetchPage("/now.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toContain("_Updated October 26, 2026 · Living in Lima, Peru_");
		expect(body).toContain("## Work");
		expect(body).toContain(`[The Remix Way](${ORIGIN}/articles/the-remix-way)`);
		expect(body).toContain("[nownownow.com](https://nownownow.com/about).");
	});

	test("writes the Spanish page for ?lang=es-AR", async () => {
		let body = await (await fetchPage("/now.md?lang=es-AR")).text();

		expect(body).toMatch(/^# Qué estoy haciendo ahora\n/);
		expect(body).toContain("Actualizado el 26 de octubre de 2026");
		expect(body).toContain("## Escribiendo y hablando");
	});
});
