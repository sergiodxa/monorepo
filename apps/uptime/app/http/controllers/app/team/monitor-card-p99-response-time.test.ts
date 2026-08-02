/**
 * Tests for the monitor detail page "P99 Response Time" stat-card fragment controller.
 * `cloudflare:workers` is mocked because `~/app/data/monitor` and
 * `~/app/services/analytics` both read `env` at module load, and the global `fetch` is
 * mocked so `queryAnalytics`'s Analytics Engine SQL API call never hits the network.
 * `ctx.team`/`ctx.membership`/auth/i18next state is seeded directly, standing in for
 * the real `requireUser`/`requireTeam`/i18n middleware chain, following the template
 * in `monitor-card-slowest-result.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { createTranslator } from "@pkg/i18n";
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

let monitorCardP99ResponseTime = (await import("./monitor-card-p99-response-time")).default as {
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

/** Sends a GET request through a minimal router mapping only the monitor p99 card route. */
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
	router.map(routes.app.team.monitors.cards.p99ResponseTime, {
		middleware: [seedTeam(team, membership)],
		handler: monitorCardP99ResponseTime.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.cards.p99ResponseTime.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

beforeEach(() => {
	kvGetMock.mockClear();
	kvGetMock.mockImplementation(async () => null);
});

describe("monitor-card-p99-response-time", () => {
	test("renders the monitor's p99 response time with its window label", async () => {
		let { db, team, membership, monitor } = await createFixture();
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(JSON.stringify({ data: [{ p99ResponseTimeMs: 842.4, totalChecks: 1200 }] })),
		) as unknown as typeof fetch;

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("P99 Response Time");
		expect(body).toContain("842 ms");
		expect(body).toContain("p99, last 24h");
	});

	test("scopes the query to this monitor and does not read the team cache", async () => {
		let { db, team, membership, monitor } = await createFixture();
		let fetchMock = mock(
			async (..._args: unknown[]) =>
				new Response(JSON.stringify({ data: [{ p99ResponseTimeMs: 100, totalChecks: 5 }] })),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		// The monitor-scoped query filters `blob1`, never `index1`, and is uncached.
		let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		let sql = init.body as string;
		expect(sql).toContain(`blob1 = '${monitor.id}'`);
		expect(sql).not.toContain(`index1 = '${team.id}'`);
		expect(kvGetMock).not.toHaveBeenCalled();
	});

	test("renders an em dash when there are no checks in range", async () => {
		let { db, team, membership, monitor } = await createFixture();
		globalThis.fetch = mock(
			async (..._args: unknown[]) =>
				new Response(JSON.stringify({ data: [{ p99ResponseTimeMs: null, totalChecks: 0 }] })),
		) as unknown as typeof fetch;

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("—");
		expect(body).not.toContain(" ms");
	});

	test("renders an em dash when the Analytics Engine query fails", async () => {
		let { db, team, membership, monitor } = await createFixture();
		globalThis.fetch = mock(
			async (..._args: unknown[]) => new Response("upstream exploded", { status: 503 }),
		) as unknown as typeof fetch;

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("P99 Response Time");
		expect(body).toContain("—");
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
