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
		PING: { create: async () => ({ id: "instance_1" }) },
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
async function get(db: Database, slug: string): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.statusPage, {
		middleware: [seedLocale()],
		handler: publicStatusPageModule as RequestHandler<any>,
	});

	let request = new Request(new URL(routes.statusPage.href({ slug }), "https://uptime.test"));

	return container.scope(() => router.fetch(request));
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
});
