/**
 * Tests for the dashboard "Monthly Pings Usage" stat-card fragment controller.
 * `cloudflare:workers` is mocked because `~/app/data/monitor` reads `env` at module
 * load. Both figures the card shows come from the local database, so there is no
 * network client to stand in for. `ctx.team`/`ctx.membership`/auth/i18next state is
 * seeded directly, standing in for the real `requireUser`/`requireTeam`/i18n
 * middleware chain, following the template in
 * `app/http/controllers/actions/monitors.test.ts`.
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
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, monitorResults, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * The bindings the page reads, real enough to answer for themselves: an empty KV is a
 * cache miss, so every test starts uncached without arranging one. They live at module
 * scope because the modules under test capture `env` on import; each test's team id is
 * fresh, so the cache keys derived from it never collide across tests.
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

let dashboardCardUsage = (await import("./dashboard-card-usage")).default as {
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

/** Creates an in-memory database seeded with one team and an owner's membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Sends a GET request through a minimal router mapping only the usage card route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.dashboard.cards.usage, {
		middleware: [seedTeam(team, membership)],
		handler: dashboardCardUsage.handler,
	});

	let request = new Request(
		new URL(routes.app.team.dashboard.cards.usage.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("dashboard-card-usage", () => {
	test("renders the pings counted from the team's own check history", async () => {
		let { db, team, membership } = await createFixture();

		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: "owner-1",
				name: "Homepage",
				url: "https://example.com",
				enabled_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
		for (let index = 0; index < 3; index++) {
			await db.create(
				monitorResults,
				{
					id: `result-${index}`,
					monitor_id: monitor.id,
					response_status: 200,
					response_time_ms: 100,
					completed_at: Date.now(),
				},
				{ touch: true },
			);
		}

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Monthly Pings Usage");
		// The three recorded results, counted as the card's consumed figure.
		expect(body).toMatch(/>3</);
	});

	test("renders the error fallback when both database queries fail", async () => {
		let { db, team, membership } = await createFixture();
		let failing = Object.create(db) as Database;
		failing.exec = vi.fn(async () => {
			throw new Error("no such table");
		}) as unknown as Database["exec"];
		failing.findMany = vi.fn(async () => {
			throw new Error("no such table");
		}) as unknown as Database["findMany"];

		let response = await send(failing, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Error");
		expect(body).toContain("-");
		expect(body).toContain("Failed to load data");
	});
});
