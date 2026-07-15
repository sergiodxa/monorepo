/**
 * Tests for the dashboard per-monitor-type count stat-card fragment controller.
 * `cloudflare:workers` is mocked because `~/app/data/monitor` and
 * `~/app/services/analytics` both read `env` at module load, and the global `fetch`
 * is mocked so the `http` resource's `queryAnalytics` call never hits the network
 * (the other resources' counts come straight from DB tables, with no analytics
 * fallback to exercise). `ctx.team`/`ctx.membership`/auth/i18next state is seeded
 * directly, standing in for the real `requireUser`/`requireTeam`/i18n middleware
 * chain, following the template in `app/http/controllers/actions/monitors.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { createInstance } from "i18next";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { dnsMonitors, memberships, monitors, teams } from "~/database/schema";
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

let dashboardCardCount = (await import("./dashboard-card-count")).default as {
	handler: RequestHandler<any>;
};

let i18nextInstance = createInstance();
await i18nextInstance.init({
	lng: "en",
	fallbackLng: "en",
	supportedLngs: ["en"],
	resources: { en: { translation: en } },
});

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

beforeEach(() => {
	kvGetMock.mockClear();
	kvGetMock.mockImplementation(async () => null);
	globalThis.fetch = mock(
		async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })),
	) as unknown as typeof fetch;
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
				record_type: "A",
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
				record_type: "MX",
				last_status: "changed",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, "dns");
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("DNS Monitors");
		expect(body).toContain("2");
		expect(body).toContain("1 ok / 1 changed / 0 error");
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
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(
					JSON.stringify({
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
		) as unknown as typeof fetch;

		let response = await send(db, team, membership, "http");
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("HTTP Monitors");
		expect(body).toContain("1 up / 0 down");
	});
});
