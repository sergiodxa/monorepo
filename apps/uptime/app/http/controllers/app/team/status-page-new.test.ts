/**
 * Tests for the new status-page form controller. `cloudflare:workers` is mocked
 * before the dynamic import because the controller's import chain pulls in
 * `~/app/data/monitor`, which touches the `QUEUE` binding at module scope
 * (see `monitors.test.ts`). `requireUser`/`requireTeam`/`i18n` are bypassed the same
 * way `monitors.test.ts` bypasses auth: a stand-in middleware seeds
 * `ctx.team`/`ctx.membership`/`ctx.i18next` directly, and `ctx.render` is backed by
 * a minimal renderer mirroring `bootstrap/app.tsx`'s `createHtmlRenderer`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

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
import { memberships, teams } from "~/database/schema";
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

let { default: statusPageNewAction } = await import("./status-page-new");

/**
 * `createAction`'s return type is `Action<route, context, middleware>`, a union of
 * a bare handler function and `{ middleware, handler }` — TypeScript can't narrow
 * to the object arm statically, even though this controller is always defined as an
 * object at runtime. This asserts the shape so `.handler` is accessible below.
 */
let statusPageNewModule = statusPageNewAction as unknown as { handler: RequestHandler<any> };

/** Stand-in for bootstrap/app.tsx's `renderWith(createHtmlRenderer)`. Nested `<Frame>` resolution is never exercised by a single-request page test, so `resolveFrame` is a harmless no-op. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

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

describe("GET /app/:team/status-pages/new", () => {
	test("renders the create status page form", async () => {
		let { db, team, membership } = await createFixture();

		let container = new ServiceContainer();
		container.instance(Database, db);

		let router = createRouter({
			middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
		});
		router.map(routes.app.team.statusPages.new, {
			middleware: [seedTeam(team, membership)],
			handler: statusPageNewModule.handler,
		});

		let request = new Request(
			new URL(routes.app.team.statusPages.new.href({ team: team.slug }), "https://uptime.test"),
		);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Create Status Page");
	});
});
