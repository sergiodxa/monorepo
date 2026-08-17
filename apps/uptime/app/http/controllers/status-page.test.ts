/**
 * Tests for the public status page controller. `cloudflare:workers` is mocked
 * before the dynamic import because the controller's import chain pulls in
 * `~/app/data/monitor` and `~/app/services/analytics`, both of which touch
 * bindings at module scope / call time (see `monitors.test.ts` and
 * `healthcheck-analytics-engine-degraded.test.ts`). This controller has no auth
 * middleware at all, so only `ctx.locale`/`ctx.i18next` are seeded — no
 * `ctx.team`/`ctx.membership`. `getTeamHttpSummaries` hits `queryAnalyticsCached`,
 * which reads `env.KV` — an in-memory namespace that really stores, so a repeated
 * render inside the cache window is served from it — and otherwise queries the
 * Analytics Engine SQL API, which MSW serves.
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

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import {
	createAnalyticsEngine,
	createEnv,
	createKVNamespace,
	createQueue,
} from "@pkg/cloudflare-mocks";
import { createTranslator } from "@pkg/i18n";
import { ServiceContainer } from "@pkg/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { SEO } from "~/app/lib/seo";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import {
	dnsMonitorRecords,
	dnsMonitors,
	monitors,
	statusPageDnsMonitors,
	statusPageMonitors,
	statusPages,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

/**
 * The bindings the page's import chain reaches for. They live at module scope because the
 * controller captures `env` on import; the dashboard cache key carries the team id and every
 * fixture creates a fresh team, so no test can read another's cached summaries.
 */
let kv = createKVNamespace();
let pingResults = createAnalyticsEngine();
let queue = createQueue();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		KV: kv,
		PING_RESULTS: pingResults,
		QUEUE: queue,
	}),
}));

let { default: publicStatusPageModule } = await import("./status-page");

/** The Analytics Engine SQL API endpoint the page's summaries are queried through. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

/** MSW server standing in for the Analytics Engine SQL API. */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every SQL query with `rows`, the shape `getTeamHttpSummaries` reads. */
function serveSummaries(rows: unknown[]) {
	server.use(http.post(SQL_URL, () => HttpResponse.json({ data: rows })));
}

/** Stand-in for bootstrap/app.tsx's `renderWith(createHtmlRenderer)`. Nested `<Frame>` resolution is never exercised by a single-request page test, so `resolveFrame` is a harmless no-op. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

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

		serveSummaries([
			{
				monitorId: monitor.id,
				totalChecks: 10,
				upChecks: 10,
				degradedChecks: 0,
				downChecks: 0,
				maxResponseTimeMs: 120,
			},
		]);

		let response = await get(db, page.slug);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(monitor.name);
		expect(body).toContain("Operational");
		expect(body).toContain("All Systems Operational");
	});

	test("publishes a team's own label for a service when they set one", async () => {
		let { db, team } = await createFixture();

		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "member-1",
				enabled_at: Date.now(),
				name: "prod-web-01",
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
				slug: "labelled-status",
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
			display_name: "Website",
			order: 0,
		});

		// The label is what this case is about, so the monitor has no summary rows to speak of.
		serveSummaries([]);

		let body = await (await get(db, page.slug)).text();

		// The chosen label is what a stranger reads; the internal name is an operational
		// detail they were never meant to see, and publishing it would also undo the
		// deliberate withholding of every other target detail on this page.
		expect(body).toContain("Website");
		expect(body).not.toContain("prod-web-01");
	});

	test("falls back to the monitor's own name when the label is blank rather than unset", async () => {
		let { db, team } = await createFixture();

		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "member-1",
				enabled_at: Date.now(),
				name: "Checkout",
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
				slug: "blank-label-status",
				title: "Acme Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: true,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		// A cleared field arrives as whitespace rather than null, and rendering it would
		// leave a nameless row on a page whose only job is saying which service is which.
		await db.create(statusPageMonitors, {
			status_page_id: page.id,
			monitor_id: monitor.id,
			display_name: "   ",
			order: 0,
		});

		serveSummaries([]);

		let body = await (await get(db, page.slug)).text();

		expect(body).toContain("Checkout");
	});

	test("labels a DNS monitor by its domain-wide coverage, and leaks no record of it", async () => {
		let { db, team } = await createFixture();

		let dnsMonitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Corporate DNS",
				domain: "internal-zone.example",
				zone_file_imported_at: Date.now(),
				interval_seconds: 86_400,
				next_due_at: null,
				is_enabled: true,
				last_checked_at: Date.now(),
				last_status: "ok",
			},
			{ touch: true, returnRow: true },
		);

		// A record of the kind the monitor now holds by the hundred. None of it is the
		// public page's business, and the assertions below are what keeps it that way.
		await db.create(
			dnsMonitorRecords,
			{
				id: crypto.randomUUID(),
				dns_monitor_id: dnsMonitor.id,
				name: "vpn.internal-zone.example",
				record_type: "A",
				value: "203.0.113.10",
				source: "zone_file",
				is_enabled: true,
				status: "ok",
				first_seen_at: Date.now(),
				last_seen_at: Date.now(),
				last_checked_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Acme Status",
				slug: "acme-dns",
				title: "Acme Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: true,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		await db.create(statusPageDnsMonitors, {
			id: crypto.randomUUID(),
			status_page_id: page.id,
			dns_monitor_id: dnsMonitor.id,
			display_name: null,
			order: 0,
		});

		serveSummaries([]);

		let response = await get(db, page.slug);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("Corporate DNS");
		// The card says what the monitor covers — a whole domain, not one record type. Read
		// through the same translator the controller uses, so the assertion holds whether the
		// locale file carries the key yet or i18next is still echoing it back.
		expect(body).toContain(i18nextInstance.t("statusPage.dns.coverage"));
		expect(body).toContain("Operational");
		// A status page is world-readable, so the domain, the names under it and the values
		// they resolve to stay out of it: that list is the owner's infrastructure map.
		expect(body).not.toContain("internal-zone.example");
		expect(body).not.toContain("vpn.internal-zone.example");
		expect(body).not.toContain("203.0.113.10");
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
		serveSummaries([]);

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

		serveSummaries([]);

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

		serveSummaries([]);

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
