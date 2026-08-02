/**
 * Tests for the public status page controller. `cloudflare:workers` is mocked
 * before the dynamic import because the controller's import chain pulls in
 * `~/app/data/monitor` and `~/app/services/analytics`, both of which touch
 * bindings at module scope / call time (see `monitors.test.ts` and
 * `healthcheck-analytics-engine-degraded.test.ts`). This controller has no auth
 * middleware at all, so only `ctx.locale`/`ctx.i18next` are seeded — no
 * `ctx.team`/`ctx.membership`. `getTeamHttpSummaries` hits `queryAnalyticsCached`,
 * which checks `env.KV.get` (mocked to a cache miss) and then calls the real
 * `fetch()` against the Analytics Engine SQL API, so `globalThis.fetch` is stubbed
 * too.
 *
 * The last two cases cover the response's cache policy rather than its markup: the
 * headers it advertises, and the `304` a viewer holding a current copy gets back.
 * Both depend on the rendered "last updated" timestamp being rounded to the cache
 * window — without that, the body would differ on every render and the validator
 * would never match.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { createInstance } from "i18next";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { monitors, statusPageMonitors, statusPages, teams } from "~/database/schema";
import routes from "~/routes/web";

let kvGetMock = mock(async (..._args: unknown[]) => null as unknown);
mock.module("cloudflare:workers", () => ({
	env: {
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		KV: { get: kvGetMock, put: mock(async () => undefined) },
		PING_RESULTS: { writeDataPoint: () => {} },
		QUEUE: { send: async () => {} },
	},
}));

let { default: publicStatusPageModule } = await import("./status-page");

/** Stand-in for bootstrap/app.tsx's `renderWith(createHtmlRenderer)`. Nested `<Frame>` resolution is never exercised by a single-request page test, so `resolveFrame` is a harmless no-op. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

let i18nextInstance = createInstance();
await i18nextInstance.init({
	lng: "en",
	fallbackLng: "en",
	supportedLngs: ["en"],
	resources: { en: { translation: en } },
});

/** For the PUBLIC status-page.tsx only — no team/auth, just i18next. */
function seedLocale(): Middleware {
	return (ctx, next) => {
		ctx.locale = "en";
		ctx.i18next = i18nextInstance;
		return next();
	};
}

/** Creates an in-memory database seeded with one team. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);

	return { db, team };
}

/** Sends a GET request through a minimal router mapping the public status page route. */
async function get(db: Database, slug: string, headers?: HeadersInit): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.statusPage, {
		middleware: [seedLocale()],
		handler: publicStatusPageModule as RequestHandler<any>,
	});

	let request = new Request(new URL(routes.statusPage.href({ slug }), "https://uptime.test"), {
		headers,
	});

	return container.scope(() => router.fetch(request));
}

/** Creates a public status page with no monitors attached, for the cache-header cases. */
async function createPublicPage(db: Database, teamId: string, slug: string) {
	return await db.create(
		statusPages,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name: "Acme Status",
			slug,
			title: "Acme Status",
			description: null,
			logo_url: null,
			custom_domain: null,
			is_public: true,
			show_overall_status: true,
		},
		{ touch: true, returnRow: true },
	);
}

describe("GET /status/:slug", () => {
	test("responds 404 for an unknown slug", async () => {
		let { db } = await createFixture();

		let response = await get(db, "does-not-exist");

		expect(response.status).toBe(404);
	});

	test("responds 404 for a private status page", async () => {
		let { db, team } = await createFixture();

		await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Private Status",
				slug: "private-status",
				title: "Private Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: false,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await get(db, "private-status");

		expect(response.status).toBe(404);
	});

	test("renders a public status page with its monitor and overall status", async () => {
		let { db, team } = await createFixture();

		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "member-1",
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Acme Status",
				slug: "acme-status",
				title: "Acme Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: true,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		await db.create(statusPageMonitors, {
			status_page_id: page.id,
			monitor_id: monitor.id,
			display_name: null,
			order: 0,
		});

		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify({
					data: [
						{
							monitorId: monitor.id,
							totalChecks: 10,
							upChecks: 10,
							degradedChecks: 0,
							downChecks: 0,
							maxResponseTimeMs: 120,
						},
					],
				}),
			);
		}) as unknown as typeof fetch;

		let response = await get(db, page.slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(monitor.name);
		expect(body).toContain("Operational");
		expect(body).toContain("All Systems Operational");
	});

	test("emits the canonical URL and the page's own description in <head>", async () => {
		let { db, team } = await createFixture();

		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Acme Status",
				slug: "acme-seo",
				title: "Acme Status",
				description: "Live availability for every Acme service.",
				logo_url: null,
				custom_domain: null,
				is_public: true,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		// No monitors attached, but `getTeamHttpSummaries` still queries Analytics
		// Engine for the team, so the SQL API fetch needs a stub either way.
		globalThis.fetch = mock(async () => {
			return new Response(JSON.stringify({ data: [] }));
		}) as unknown as typeof fetch;

		let response = await get(db, page.slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		// Canonical is normalized onto the product's own origin, not the request host.
		expect(body).toContain(
			`<link rel="canonical" href="${SEO.baseUrl}${routes.statusPage.href({ slug: page.slug })}" />`,
		);
		expect(body).toContain(
			'<meta name="description" content="Live availability for every Acme service." />',
		);
	});

	test("serves a public, revalidatable cache policy with a validator", async () => {
		let { db, team } = await createFixture();
		let page = await createPublicPage(db, team.id, "acme-cache");

		globalThis.fetch = mock(async () => {
			return new Response(JSON.stringify({ data: [] }));
		}) as unknown as typeof fetch;

		let response = await get(db, page.slug);

		expect(response.status).toBe(200);
		// 60 seconds is the KV TTL of the Analytics Engine query behind the page, so the
		// page can never be served staler than its own data source.
		expect(response.headers.get("Cache-Control")).toBe(
			"public, max-age=60, stale-while-revalidate=300",
		);
		// Both dimensions the markup is translated on, so a shared cache cannot hand one
		// viewer another viewer's language.
		expect(response.headers.get("Vary")).toBe("accept-language, cookie");
		expect(response.headers.get("ETag")).toMatch(/^W\/".+"$/);
	});

	test("answers a viewer holding the current copy with a 304 and no body", async () => {
		let { db, team } = await createFixture();
		let page = await createPublicPage(db, team.id, "acme-conditional");

		globalThis.fetch = mock(async () => {
			return new Response(JSON.stringify({ data: [] }));
		}) as unknown as typeof fetch;

		let first = await get(db, page.slug);
		let tag = first.headers.get("ETag");
		expect(tag).not.toBeNull();
		expect(await first.text()).not.toBe("");

		// The rendered timestamp is rounded to the cache window, so a second render
		// inside that window is byte-identical and the viewer's tag still matches.
		let second = await get(db, page.slug, tag === null ? undefined : { "If-None-Match": tag });

		expect(second.status).toBe(304);
		expect(second.headers.get("ETag")).toBe(tag);
		expect(second.headers.get("Cache-Control")).toBe(
			"public, max-age=60, stale-while-revalidate=300",
		);
		expect(await second.text()).toBe("");
	});
});
