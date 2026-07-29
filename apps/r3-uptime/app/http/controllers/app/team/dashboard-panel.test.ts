/**
 * Tests for the dashboard tab-panel fragment controller. `cloudflare:workers` is
 * mocked so the HTTP tab's `getTeamHttpSummaries`/`getTeamHttpSparklines` (which hit
 * the Analytics Engine SQL HTTP API via `fetch`, using `env.CLOUDFLARE_ACCOUNT_ID`/
 * `env.CLOUDFLARE_ANALYTICS_TOKEN`) never touch real Cloudflare bindings.
 * `requireUser`/`requireTeam`/`i18n` are bypassed the same way as the other
 * page-controller tests in this directory: `ctx.team`/`ctx.membership`/`ctx.i18next`
 * are seeded directly, and `ctx.render` is stood in for with a minimal renderer
 * mirroring `bootstrap/app.tsx`'s own `createHtmlRenderer`.
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
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

let kvGetMock = mock(async (..._args: unknown[]) => null as unknown);

mock.module("cloudflare:workers", () => ({
	env: {
		CLOUDFLARE_ACCOUNT_ID: "acct-1",
		CLOUDFLARE_ANALYTICS_TOKEN: "token-1",
		KV: { get: kvGetMock, put: mock(async () => undefined) },
		PING_RESULTS: { writeDataPoint: () => {} },
		QUEUE: { send: async () => {} },
	},
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

let i18nextInstance = createInstance();
await i18nextInstance.init({
	lng: "en",
	fallbackLng: "en",
	supportedLngs: ["en"],
	resources: { en: { translation: en } },
});

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

describe("app/team/dashboard-panel", () => {
	beforeEach(() => {
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })),
		) as unknown as typeof fetch;
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
		let refreshLink = body.match(/<a[^>]*rmx-src="[^"]*\/panel\/http\?refresh=[^"]*"[^>]*>/)?.[0];
		expect(refreshLink).toBeDefined();
		expect(refreshLink).toContain('rmx-target="dashboard-panel"');
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
});
