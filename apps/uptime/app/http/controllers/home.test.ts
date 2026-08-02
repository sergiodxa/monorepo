/**
 * Tests the `/` controller: it renders the public marketing homepage inside the
 * shared document/marketing chrome for both anonymous and signed-in viewers, with the
 * hero CTA switching between a sign-in form and a dashboard link, its full head
 * metadata set and `WebSite` structured data, and every section of the page — hero
 * screenshot, trust indicators, feature/use-case grids, the pricing calculator's
 * server-rendered baseline, and the FAQ — present in the markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

import home from "./home";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Sets the `Auth` context state directly, standing in for the real session-backed `auth` middleware. */
function seedAuth(viewer: Viewer | null): Middleware {
	return (ctx, next) => {
		if (viewer) ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		else ctx.set(Auth, { ok: false });
		return next();
	};
}

/**
 * Dispatches a real GET request to `/` with the given signed-in state. Includes the
 * real `i18n` middleware — `home.tsx` renders its copy through `ctx.i18next.t()` —
 * backed by an empty test database (only consulted for a signed-in viewer's saved
 * language preference, which none of these tests set, so it falls back to English).
 */
async function getHome(viewer: Viewer | null) {
	let { db } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			seedAuth(viewer),
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.home, home);

	let request = new Request(`https://uptime.test${routes.home.href()}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /", () => {
	test("renders the marketing homepage for an anonymous visitor", async () => {
		let response = await getHome(null);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Uptime by Sergio Xalambrí</title>");
		expect(body).toContain("Monitor your services");
		expect(body).toContain("with confidence");
		expect(body).toContain("Start Monitoring");
	});

	test("emits the whole head metadata set and the WebSite structured data", async () => {
		let response = await getHome(null);
		let body = await response.text();

		// The tag set is pinned in full because a regression here — a canonical on the
		// serving host, a dropped `og:url` — is invisible to every other assertion.
		expect(body).toContain(
			[
				"<title>Uptime by Sergio Xalambrí</title>",
				'<meta name="description" content="Simple &amp; reliable uptime monitoring for developers" />',
				`<link rel="canonical" href="${SEO.baseUrl}/" />`,
				'<meta property="og:type" content="website" />',
				`<meta property="og:url" content="${SEO.baseUrl}/" />`,
				'<meta property="og:site_name" content="Uptime" />',
				'<meta property="og:title" content="Uptime by Sergio Xalambrí" />',
				'<meta property="og:description" content="Simple &amp; reliable uptime monitoring for developers" />',
				'<meta name="twitter:card" content="summary_large_image" />',
				'<meta name="twitter:title" content="Uptime by Sergio Xalambrí" />',
				'<meta name="twitter:description" content="Simple &amp; reliable uptime monitoring for developers" />',
			].join(""),
		);
		// The root is the one URL that keeps its trailing slash.
		expect(body).toContain(`"@type":"WebSite","name":"Uptime","url":"${SEO.baseUrl}"`);
	});

	test("renders the hero screenshot with a preloaded variant per color scheme", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain(
			'<link rel="preload" href="/screenshot-light.webp" as="image" media="(prefers-color-scheme: light)" />',
		);
		expect(body).toContain(
			'<link rel="preload" href="/screenshot-dark.webp" as="image" media="(prefers-color-scheme: dark)" />',
		);
		expect(body).toContain('srcset="/screenshot-dark.webp"');
		// The `<img>` fallback for engines that don't pick a `<source>`.
		expect(body).toContain('src="/screenshot-light.webp"');
		expect(body).toContain("Screenshot of the Uptime dashboard");
	});

	test("renders the trust indicators, feature grid, and use-case grid", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain("99.9%");
		expect(body).toContain("Uptime SLA");
		expect(body).toContain("365");

		// Feature cards link to their own page and carry the "learn more" affordance.
		expect(body).toContain(`href="${routes.marketing.feature.href({ slug: "monitors" })}"`);
		expect(body).toContain("Learn more");

		// The secondary capability rows, which have no destination of their own.
		expect(body).toContain("Maintenance Windows");
		expect(body).toContain("Cron Job Monitoring");

		expect(body).toContain(
			`href="${routes.marketing.useCase.href({ slug: "website-monitoring" })}"`,
		);
		expect(body).toContain(`href="${routes.marketing.audience.href({ slug: "indie-hackers" })}"`);
	});

	test("server-renders the pricing calculator's initial estimate", async () => {
		let response = await getHome(null);
		let body = await response.text();

		expect(body).toContain("Pricing Calculator");
		// One monitor's slider, bounded at 1 and 60 minutes.
		expect(body).toContain('type="range"');
		expect(body).toContain('min="1"');
		expect(body).toContain('max="60"');
		// 28 days × 24 h × 60 min ÷ 10 min, which the base subscription fully covers.
		expect(body).toContain("4,032");
		expect(body).toContain("Total monthly cost:");
		expect(body).toContain("How pricing works");
	});

	test("renders every FAQ entry across two accordion columns", async () => {
		let response = await getHome(null);
		let body = await response.text();

		// One `<details>` per entry, all nineteen of them.
		expect(body.match(/<details/g)).toHaveLength(19);
		expect(body).toContain("How does Uptime monitor my services?");
		expect(body).toContain("From which regions can I monitor my services?");
	});

	test("renders the marketing homepage for a signed-in viewer with a dashboard CTA", async () => {
		let viewer: Viewer = {
			id: "user-1",
			name: "Ada Lovelace",
			email: "ada@example.com",
			avatar: "",
		};

		let response = await getHome(viewer);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Open Dashboard");
		expect(body).toContain(`href="${routes.app.index.href()}"`);
	});
});
