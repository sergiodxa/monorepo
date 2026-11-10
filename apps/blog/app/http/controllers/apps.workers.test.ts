/**
 * Drives `/apps` through the real router inside workerd, against the local session KV: the
 * showcase in each language, its Markdown twin by extension and by `Accept`, and the apps it
 * links out to.
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

describe("GET /apps", () => {
	test("renders the English showcase with every app and its home", async () => {
		let response = await fetchPage("/apps");
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toMatch(/<title[^>]*>Apps<\/title>/);
		expect(html).toContain('lang="en"');
		expect(html).toContain("Apps I ");
		expect(html).toContain(">built<");
		expect(html).toContain("App Store and the web");
		expect(html).toContain("See the apps");
		for (let name of ["Wakaba", "Encore", "Uptime", "Reader"]) {
			expect(html).toContain(name);
		}
		expect(html).toContain('href="/apps/wakaba"');
		expect(html).toContain('href="/apps/encore"');
		expect(html).toContain('href="https://uptime.sergiodxa.com"');
		expect(html).toContain('href="https://reader.sergiodxa.com"');
		expect(html).toContain("/apps/wakaba/screenshots/en/path-progress-light.webp");
		expect(html).toContain("/apps/encore/screenshots/en/challenge-light.webp");
		expect(html).toContain("api.example.com/health");
		expect(html).toContain("99.97%");
		expect(html).toContain("Harbor Daily");
		expect(html).toContain("2 feeds still arriving");
		expect(html).toContain("Open Wakaba");
		expect(html).toContain("Open Encore");
		expect(html).toContain("Pause the animation");
		expect(html).not.toContain('href="/apps?lang=es-AR"');
		expect(html).not.toContain('href="/apps.md?lang=en"');
		expect(html).toContain('property="og:image" content="https://sergiodxa.com/apps.png?v=');
		expect(html).toContain('name="twitter:card" content="summary_large_image"');
	});

	test("answers in Spanish for a Spanish browser or ?lang=es", async () => {
		let byHeader = await (
			await fetchPage("/apps", { headers: { "accept-language": "es-MX" } })
		).text();
		let byQuery = await (await fetchPage("/apps?lang=es")).text();

		for (let html of [byHeader, byQuery]) {
			expect(html).toMatch(/<title[^>]*>Apps<\/title>/);
			expect(html).toContain('lang="es-AR"');
			expect(html).toContain("Apps que ");
			expect(html).toContain(">construí<");
			expect(html).toContain("App Store");
		}
	});

	test("answers Markdown when the request prefers it", async () => {
		let response = await fetchPage("/apps", { headers: { accept: "text/markdown" } });

		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(await response.text()).toMatch(/^# Apps I built\n/);
	});
});

describe("GET /apps.md", () => {
	test("writes each app as a linked heading with its platform and pitch", async () => {
		let response = await fetchPage("/apps.md");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/markdown");
		expect(body).toMatch(/^# Apps I built\n/);
		expect(body).toContain("## [Wakaba](/apps/wakaba)");
		expect(body).toContain("## [Encore](/apps/encore)");
		expect(body).toContain("## [Uptime](https://uptime.sergiodxa.com)");
		expect(body).toContain("## [Reader](https://reader.sergiodxa.com)");
		expect(body).toContain("_App Store_");
	});

	test("writes the Spanish page for ?lang=es-AR", async () => {
		let body = await (await fetchPage("/apps.md?lang=es-AR")).text();

		expect(body).toMatch(/^# Apps que construí\n/);
		expect(body).toContain("_Web_");
	});
});
