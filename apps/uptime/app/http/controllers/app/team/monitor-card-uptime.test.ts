/**
 * Tests for the monitor detail page "Uptime percentage" stat-card fragment
 * controller. `cloudflare:workers` is mocked because `~/app/data/monitor` reads `env`
 * at module load. `ctx.team`/`ctx.membership`/auth/i18next state is seeded directly,
 * standing in for the real `requireUser`/`requireTeam`/i18n middleware chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { createTranslator } from "@sdxc/i18n";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ CLOUDFLARE_ACCOUNT_ID: "acct-1", CLOUDFLARE_ANALYTICS_TOKEN: "token-1" }),
}));

let monitorCardUptime = (await import("./monitor-card-uptime")).default as {
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

/** Sends a GET request through a minimal router mapping only the monitor uptime card route. */
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
	router.map(routes.app.team.monitors.cards.uptime, {
		middleware: [seedTeam(team, membership)],
		handler: monitorCardUptime.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.cards.uptime.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("monitor-card-uptime", () => {
	test("renders the uptime percentage from the monitor's daily stats", async () => {
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
		expect(body).toContain("Uptime percentage");
		expect(body).toContain("100%");
	});

	test("renders a dash when the monitor has no daily stats yet", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Uptime percentage");
		expect(body).toContain("—");
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
