/**
 * Tests for the monitor detail page "Slowest Result" stat-card fragment controller.
 * `cloudflare:workers` is mocked because `~/app/data/monitor` and
 * `~/app/services/analytics` both read `env` at module load; the bindings behind it are
 * in-memory implementations. `queryAnalytics`'s Analytics Engine SQL API call is
 * intercepted by MSW, so it never hits the network.
 * `ctx.team`/`ctx.membership`/auth/i18next state is seeded directly, standing in for
 * the real `requireUser`/`requireTeam`/i18n middleware chain, following the template
 * in `dashboard-card-slowest-endpoint.test.ts`.
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
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The bindings the import chain captures on load, so they live at module scope. */
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

let monitorCardSlowestResult = (await import("./monitor-card-slowest-result")).default as {
	handler: RequestHandler<any>;
};

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

/** Creates an in-memory database seeded with one team, a member's membership, and one monitor. */
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

	return { db, team, membership, monitor };
}

/** Sends a GET request through a minimal router mapping only the monitor slowest-result card route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.monitors.cards.slowestResult, {
		middleware: [seedTeam(team, membership)],
		handler: monitorCardSlowestResult.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.cards.slowestResult.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

/** The Analytics Engine SQL API endpoint `queryAnalytics` POSTs to. */
let SQL_URL = "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql";

/** MSW server intercepting the Analytics Engine SQL API. */
let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	queue.reset();
	pingResults.reset();
});

describe("monitor-card-slowest-result", () => {
	test("renders the monitor's slowest response time", async () => {
		let { db, team, membership, monitor } = await createFixture();
		server.use(http.post(SQL_URL, () => HttpResponse.json({ data: [{ maxResponseTimeMs: 842 }] })));

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Slowest Result");
		expect(body).toContain("842ms");
	});

	test("renders N/A when there are no checks in range", async () => {
		let { db, team, membership, monitor } = await createFixture();
		server.use(http.post(SQL_URL, () => HttpResponse.json({ data: [] })));

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("N/A");
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();
		// A monitor the team doesn't own is rejected before any query is billed, which this
		// handler and the `onUnhandledRequest: "error"` guard together hold the card to.
		server.use(
			http.post(SQL_URL, () => {
				throw new Error("the slowest-result card must not query for a monitor outside the team");
			}),
		);

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
