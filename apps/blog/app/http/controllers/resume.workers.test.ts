/**
 * Drives `/resume` through the real router inside workerd, against the local session KV: the
 * designed résumé in each language with its PDF download, and its Markdown twin by extension
 * and by `Accept`.
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

describe("GET /resume", () => {
	test("renders the English résumé with its sections and language switch, without an unpublished PDF", async () => {
		let response = await fetchPage("/resume");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Résumé<\/title>/);
		expect(html).toContain('lang="en"');
		for (let heading of ["Experience", "Open source", "Talks and writing", "Skills"]) {
			expect(html).toContain(heading);
		}
		expect(html).toContain("Support Engineer");
		expect(html).not.toContain("sergio-xalambri-resume-en.pdf");
		expect(html).toContain('href="/resume?lang=es-AR"');
	});

	test("answers in Spanish for a Spanish browser or ?lang=es", async () => {
		let byHeader = await (
			await fetchPage("/resume", { headers: { "accept-language": "es-PE" } })
		).text();
		let byQuery = await (await fetchPage("/resume?lang=es")).text();

		for (let html of [byHeader, byQuery]) {
			expect(html).toMatch(/<title[^>]*>Currículum<\/title>/);
			expect(html).toContain("Experiencia");
			expect(html).not.toContain("sergio-xalambri-resume-es-AR.pdf");
		}
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/resume", { headers: { accept: "text/markdown" } });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toContain("## Experience");
	});
});

describe("GET /resume.md", () => {
	test("writes the résumé as Markdown, linking no PDF until one is published", async () => {
		let response = await fetchPage("/resume.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toMatch(/^# Sergio Xalambrí\n/);
		expect(body).not.toContain("/resume/sergio-xalambri-resume-en.pdf");
	});

	test("writes the Spanish résumé for ?lang=es-AR", async () => {
		let body = await (await fetchPage("/resume.md?lang=es-AR")).text();

		expect(body).toContain("## Experiencia");
		expect(body).not.toContain("[Descargar PDF]");
	});
});
