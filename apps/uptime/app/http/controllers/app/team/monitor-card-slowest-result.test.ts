/**
 * Tests for the monitor detail page "Slowest Result" stat-card fragment controller.
 * `cloudflare:workers` is mocked because `~/app/data/monitor` and
 * `~/app/services/analytics` both read `env` at module load, and the global `fetch` is
 * mocked so `queryAnalytics`'s Analytics Engine SQL API call never hits the network.
 * `ctx.team`/`ctx.membership`/auth/i18next state is seeded directly, standing in for
 * the real `requireUser`/`requireTeam`/i18n middleware chain, following the template
 * in `dashboard-card-slowest-endpoint.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createTranslator } from "@pkg/i18n";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
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

beforeEach(() => {
	kvGetMock.mockClear();
	kvGetMock.mockImplementation(async () => null);
});

describe("monitor-card-slowest-result", () => {
	test("renders the monitor's slowest response time", async () => {
		let { db, team, membership, monitor } = await createFixture();
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(JSON.stringify({ data: [{ maxResponseTimeMs: 842 }] })),
		) as unknown as typeof fetch;

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Slowest Result");
		expect(body).toContain("842ms");
	});

	test("renders N/A when there are no checks in range", async () => {
		let { db, team, membership, monitor } = await createFixture();
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })),
		) as unknown as typeof fetch;

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("N/A");
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response(JSON.stringify({ data: [] })),
		) as unknown as typeof fetch;

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
