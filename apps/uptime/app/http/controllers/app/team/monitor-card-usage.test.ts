/**
 * Tests for the monitor detail page "Monthly Pings Usage" stat-card fragment
 * controller. `cloudflare:workers` is mocked because `~/app/data/monitor` reads `env`
 * at module load, and a fake `PolarClient` stands in for the real Polar SDK client so
 * `Customer.getUsagePerMonthForMonitor` never makes a network call. Whether the owner is
 * subscribed is seeded into the `subscriptions` projection rather than stubbed on the
 * client (ADR-005), since that is where the controller reads it from. `ctx.team`/`ctx.membership`/auth/i18next state is seeded directly,
 * standing in for the real `requireUser`/`requireTeam`/i18n middleware chain,
 * following the template in `dashboard-card-usage.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { createTranslator } from "@pkg/i18n";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { createActiveSubscription } from "~/app/lib/test/polar";
import en from "~/app/locales/en";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("cloudflare:workers", () => ({
	env: { CLOUDFLARE_ACCOUNT_ID: "acct-1", CLOUDFLARE_ANALYTICS_TOKEN: "token-1" },
}));

let monitorCardUsage = (await import("./monitor-card-usage")).default as {
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

/** Creates an in-memory database seeded with one team, an owner's membership, and one monitor. */
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

/** Sends a GET request through a minimal router mapping only the monitor usage card route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
	polar: PolarClient,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.monitors.cards.usage, {
		middleware: [seedTeam(team, membership)],
		handler: monitorCardUsage.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.cards.usage.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("monitor-card-usage", () => {
	test("renders unavailable usage when the team owner has no active subscription", async () => {
		let { db, team, membership, monitor } = await createFixture();
		let polar = { getMeterUsage: mock(async () => 0) } as unknown as PolarClient;

		let response = await send(db, team, membership, monitor.id, polar);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Monthly Pings Usage");
		expect(body).toContain("—");
	});

	test("renders the usage stat when the team owner has an active subscription", async () => {
		let { db, team, membership, monitor } = await createFixture();
		let polar = { getMeterUsage: mock(async () => 42) } as unknown as PolarClient;
		await createActiveSubscription(db, team.owner_id);

		let response = await send(db, team, membership, monitor.id, polar);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Monthly Pings Usage");
		expect(body).toContain("42");
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();
		let polar = { getMeterUsage: mock(async () => 0) } as unknown as PolarClient;

		let response = await send(db, team, membership, crypto.randomUUID(), polar);
		expect(response.status).toBe(404);
	});
});
