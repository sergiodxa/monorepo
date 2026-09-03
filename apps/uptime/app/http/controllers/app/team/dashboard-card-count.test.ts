/**
 * Tests for the dashboard per-monitor-type count stat-card fragment controller.
 * `cloudflare:workers` is mocked because `~/app/data/monitor` and
 * `~/app/services/analytics` both read `env` at module load. MSW intercepts
 * the `http` resource's `queryAnalytics` call so it never hits the network;
 * every other resource's count comes straight from DB tables. `ctx.team`,
 * `ctx.membership`, auth, and i18next state are seeded directly, standing in
 * for the real `requireUser`/`requireTeam`/i18n middleware chain.
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
 * An empty KV is a cache miss, so every test starts uncached without arranging
 * one. These live at module scope since the modules under test capture `env`
 * on import, and each test's fresh team id keeps its cache keys collision-free.
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

let dashboardCardCount = (await import("./dashboard-card-count")).default as {
	handler: RequestHandler<any>;
};

let { buildCacheKey } = await import("~/app/services/analytics");

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s `createHtmlRenderer`. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Middleware that seeds `ctx.team`/`ctx.membership`/auth/i18next state, standing in for the real chain. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};

	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = [team];
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

/** Sends a GET request through a minimal router mapping only the count card route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	resource: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.dashboard.cards.count, {
		middleware: [seedTeam(team, membership)],
		handler: dashboardCardCount.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.dashboard.cards.count.href({ team: team.slug, resource }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

/** The Analytics Engine SQL API endpoint `queryAnalytics` POSTs to. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

/**
 * MSW server intercepting the Analytics Engine SQL API. The default handler answers
 * with no rows, which is every resource except `http`; that one replaces it per test.
 */
let server = setupServer(http.post(SQL_URL, () => HttpResponse.json({ data: [] })));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	queue.reset();
	pingResults.reset();
});

describe("dashboard-card-count", () => {
	test("resource=dns renders the DNS monitor count and status breakdown", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Root A record",
				domain: "example.com",
				last_status: "ok",
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "MX record",
				domain: "example.com",
				last_status: "changed",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, "dns");
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("DNS Monitors");
		expect(body).toContain("2");
		/**
		 * Each state renders its own badge, so every part stays separately
		 * translatable, and only for a state with a nonzero count — a blank "0
		 * error" line was dead weight that pushed every card to three lines tall.
		 */
		expect(body).toContain(">1 ok</span>");
		expect(body).toContain(">1 changed</span>");
		expect(body).not.toContain("0 error");
		/** Colored by state, so severity reads at a glance. */
		expect(body).toContain('data-color="success"');
		expect(body).toContain('data-color="warning"');
		/**
		 * Each card links straight to its own monitor type's creation form, since
		 * the quick check replaced the single header "create monitor" button that
		 * used to route everyone through a picker.
		 */
		expect(body).toContain(`href="${routes.app.team.dnsMonitors.new.href({ team: team.slug })}"`);
		expect(body).toContain(`aria-label="${en.page.dashboard.stats.dnsMonitors.create}"`);
	});

	test("resource=dns draws no badges at all for a team with nothing to report", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await send(db, team, membership, "dns")).text();

		/**
		 * When every state is zero, the breakdown renders no pills at all. Cards
		 * share a flex row and stretch to whichever has the most to say, so an
		 * empty card keeps the row's alignment intact.
		 */
		expect(body).toContain("DNS Monitors");
		expect(body).not.toContain("0 ok");
		expect(body).not.toContain("0 changed");
		expect(body).not.toContain("0 error");
	});

	test("resource=http renders the HTTP monitor count and up/down breakdown", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);
		server.use(
			http.post(SQL_URL, () =>
				HttpResponse.json({
					data: [
						{
							monitorId: monitor.id,
							totalChecks: 10,
							upChecks: 10,
							degradedChecks: 0,
							downChecks: 0,
							maxResponseTimeMs: 100,
						},
					],
				}),
			),
		);

		let response = await send(db, team, membership, "http");
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("HTTP Monitors");
		expect(body).toContain(">1 up</span>");
		expect(body).not.toContain("0 down");
		expect(body).toContain(`href="${routes.app.team.monitors.new.href({ team: team.slug })}"`);
		expect(body).toContain(`aria-label="${en.page.dashboard.stats.httpMonitors.create}"`);
		/**
		 * Card loads read the KV cache first, so this write has to land in the
		 * namespace for the next load to find it.
		 */
		expect(await kv.get(buildCacheKey(team.id, "httpSummaries"), "json")).not.toBeNull();
	});
});
