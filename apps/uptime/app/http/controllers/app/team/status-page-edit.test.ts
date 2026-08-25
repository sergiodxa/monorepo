/**
 * Tests for the edit status-page form controller. `cloudflare:workers` is mocked
 * before the dynamic import because the controller's import chain pulls in
 * `~/app/data/monitor`, which touches the `QUEUE` binding at module scope; the
 * bindings behind it are in-memory implementations, and the env is strict, so a
 * binding this form reaches for without supplying fails by name.
 * `requireUser`/`requireTeam`/`i18n` are bypassed the same way auth is: a stand-in middleware seeds
 * `ctx.team`/`ctx.membership`/`ctx.i18next` directly, and `ctx.render` is backed by
 * a minimal renderer mirroring `bootstrap/app.tsx`'s `createHtmlRenderer`.
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
import { memberships, statusPages, teams } from "~/database/schema";
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

let { default: statusPageEditAction } = await import("./status-page-edit");

/**
 * `createAction`'s return type is `Action<route, context, middleware>`, a union of a
 * bare handler function and `{ middleware, handler }` that TypeScript can't narrow
 * statically; this asserts the object shape so `.handler` is accessible below.
 */
let statusPageEditModule = statusPageEditAction as unknown as { handler: RequestHandler<any> };

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

/** Sends a GET request through a minimal router mapping the status page edit route. */
async function get(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	statusPageId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.statusPages.edit, {
		middleware: [seedTeam(team, membership)],
		handler: statusPageEditModule.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.statusPages.edit.href({ team: team.slug, statusPageId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("GET /app/:team/status-pages/:statusPageId/edit", () => {
	test("renders the edit form for a status page belonging to the team", async () => {
		let { db, team, membership } = await createFixture();

		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Acme Status",
				slug: "acme-status",
				title: "Acme Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: true,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await get(db, team, membership, page.id);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Edit Status Page");
		expect(body).toContain(page.name);
	});

	/**
	 * The regex requires `checked` immediately after the attribute name since the switch's own `:has(~ input:checked)` CSS text elsewhere in the body would satisfy a substring match, and a boolean attribute holds whenever merely present, so a stored `false` serialized as `0` would still render a ticked switch.
	 */
	test("renders stored false switches unticked, and stored true ones ticked", async () => {
		let { db, team, membership } = await createFixture();

		let page = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Acme Status",
				slug: "acme-status",
				title: "Acme Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: false,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await get(db, team, membership, page.id);
		let body = await response.text();

		expect(body).not.toMatch(/name="is_public"[^>]*\schecked/);
		expect(body).toMatch(/name="show_overall_status"[^>]*\schecked/);
	});

	test("responds 404 for a status page id that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await get(db, team, membership, crypto.randomUUID());

		expect(response.status).toBe(404);
	});

	test("responds 404 for a status page belonging to a different team", async () => {
		let { db, team, membership } = await createFixture();

		let otherTeam = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-2", name: "Other", slug: "other", logo: null },
			{ touch: true, returnRow: true },
		);
		let otherPage = await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				name: "Other Status",
				slug: "other-status",
				title: "Other Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: true,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await get(db, team, membership, otherPage.id);

		expect(response.status).toBe(404);
	});
});
