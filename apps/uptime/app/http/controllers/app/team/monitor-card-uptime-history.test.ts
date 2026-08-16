/**
 * Tests for the monitor detail page uptime-history fragment controller.
 * `cloudflare:workers` is mocked because `~/app/data/monitor` reads `env` at module
 * load. `ctx.team`/`ctx.membership`/auth state is seeded directly, standing in for the
 * real `requireUser`/`requireTeam` middleware chain, and the `i18n` middleware runs for
 * real because the bar's captions and legend arrive pre-translated from the controller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({ CLOUDFLARE_ACCOUNT_ID: "acct-1", CLOUDFLARE_ANALYTICS_TOKEN: "token-1" }),
}));

let monitorCardUptimeHistory = (await import("./monitor-card-uptime-history")).default as {
	handler: RequestHandler<any>;
};

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s `createHtmlRenderer`. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Middleware that seeds `ctx.team`/`ctx.membership`/auth state, standing in for the real chain. */
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

/** Sends a GET request through a minimal router mapping only the monitor uptime-history card route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.monitors.cards.uptimeHistory, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler: monitorCardUptimeHistory.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.cards.uptimeHistory.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("monitor-card-uptime-history", () => {
	test("renders the uptime bar from the monitor's recent daily stats", async () => {
		let { db, team, membership, monitor } = await createFixture();
		let today = new Date().toISOString().slice(0, 10);
		await MonitorDailyStats.upsertDay(db, {
			monitor_id: monitor.id,
			monitor_type: "http",
			date: today,
			total_checks: 10,
			successful_checks: 10,
			failed_checks: 0,
			avg_response_time_ms: 100,
			max_response_time_ms: 120,
			status: "up",
		});

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain(`${today}: up (10/10)`);
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
