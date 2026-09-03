/**
 * Tests for the dashboard tab-panel fragment controller. `cloudflare:workers` is
 * mocked so the HTTP tab's Analytics Engine SQL queries never touch real
 * Cloudflare bindings, and MSW intercepts that API so they never leave the
 * process either. `requireUser`/`requireTeam`/`i18n` are bypassed by seeding
 * `ctx.team`/`ctx.membership`/`ctx.i18next` directly, with `ctx.render` stood
 * in for by a minimal renderer.
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
} from "@sdxc/cloudflare-mocks";
import { createTranslator } from "@sdxc/i18n";
import { ServiceContainer } from "@sdxc/service-container";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { dnsMonitors, memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * The bindings the page reads, real enough that an empty KV starts every test
 * uncached without arranging one. They live at module scope because the modules
 * under test capture `env` on import; each test's fresh team id keeps its cache keys from colliding.
 */
let kv = createKVNamespace();
let queue = createQueue();
let pingResults = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		KV: kv,
		PING_RESULTS: pingResults,
		QUEUE: queue,
	}),
}));

let dashboardPanelModule = await import("./dashboard-panel");

/** Stand-in for bootstrap/app.tsx's `renderWith(createHtmlRenderer)`. Frame resolution isn't exercised by a single-request page test, so `resolveFrame` is a no-op. */
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

/** Seeds ctx.team/ctx.membership/ctx.teams/ctx.locale/ctx.i18next + Auth, standing in for requireUser+requireTeam+i18n. */
function seedTeam(
	team: SelectTeam,
	membership: SelectMembership,
	teamsList: SelectTeam[] = [team],
): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};

	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = teamsList;
		ctx.locale = "en";
		ctx.i18next = i18nextInstance;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** Creates an in-memory database seeded with one team and a member's membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Sends a request for a given dashboard panel `type` through a minimal router. */
async function fetchPanel(
	db: Awaited<ReturnType<typeof createFixture>>["db"],
	team: SelectTeam,
	membership: SelectMembership,
	type: string,
): Promise<Response> {
	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.dashboard.panel, {
		middleware: [seedTeam(team, membership)],
		handler: (dashboardPanelModule.default as { handler: RequestHandler<any> }).handler,
	});

	let container = new ServiceContainer();
	container.instance(Database, db);

	let request = new Request(
		new URL(
			routes.app.team.dashboard.panel.href({ team: team.slug, type: type as never }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

let server = setupServer(http.post(SQL_URL, () => HttpResponse.json({ data: [] })));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("app/team/dashboard-panel", () => {
	beforeEach(() => {
		queue.reset();
		pingResults.reset();
	});

	test("http tab renders the seeded monitor's name and table columns", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
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

		let response = await fetchPanel(db, team, membership, "http");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Homepage");
		expect(body).toContain(en.page.dashboard.table.columns.name);
		expect(body).toContain(en.page.dashboard.table.columns.latencyChart);
		expect(body).toContain(en.page.dashboard.table.columns.status);
	});

	test("http tab renders the empty state when the team has no monitors", async () => {
		let { db, team, membership } = await createFixture();

		let response = await fetchPanel(db, team, membership, "http");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(en.page.dashboard.empty.title);
		expect(body).toContain(en.page.dashboard.empty.description);
		expect(body).toContain(en.page.dashboard.empty.cta);
	});

	test("renders a refresh link targeting the dashboard panel frame", async () => {
		let { db, team, membership } = await createFixture();

		let response = await fetchPanel(db, team, membership, "http");

		expect(response.status).toBe(200);
		let body = await response.text();
		let refreshLink = body.match(
			/<a[^>]*data-rmx-src="[^"]*\/panel\/http\?refresh=[^"]*"[^>]*>/,
		)?.[0];
		expect(refreshLink).toBeDefined();
		expect(refreshLink).toContain('data-rmx-target="dashboard-panel"');
		expect(refreshLink).toContain(
			`href="${routes.app.team.dashboard.index.href({ team: team.slug })}?tab=http"`,
		);
		expect(body).toContain(en.page.dashboard.panel.refresh);
	});

	test("dns tab renders the empty state when the team has no DNS monitors", async () => {
		let { db, team, membership } = await createFixture();

		let response = await fetchPanel(db, team, membership, "dns");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain(en.page.dnsMonitors.empty.title);
	});

	/** An unchecked monitor's cell is copy like any other, and belongs in the locale file. */
	test("dns tab reads its never-checked label from the locale", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true },
		);

		let body = await (await fetchPanel(db, team, membership, "dns")).text();

		expect(body).toContain(en.page.dnsMonitors.table.notChecked);
		expect(body).not.toContain("not checked");
	});
});
