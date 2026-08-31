/**
 * Tests for the new status-page form controller. `cloudflare:workers` is
 * mocked before the dynamic import since the import chain touches the
 * `QUEUE` binding at module scope, and this strict env fails by name when a
 * binding isn't supplied. `requireUser`, `requireTeam`, and `i18n` are
 * bypassed the same way, through a stand-in middleware seeding `ctx.team`.
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
import { flowMonitors, memberships, monitors, teams } from "~/database/schema";
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

let { default: statusPageNewAction } = await import("./status-page-new");

/**
 * `createAction` returns a union TypeScript can't narrow to the object arm
 * statically, even though this controller is always defined that way at
 * runtime, so this assertion makes `.handler` accessible below.
 */
let statusPageNewModule = statusPageNewAction as unknown as { handler: RequestHandler<any> };

/**
 * Stand-in for `bootstrap/app.tsx`'s `renderWith(createHtmlRenderer)`, sized
 * for a single-request page test where `resolveFrame` only ever returns a
 * harmless no-op.
 */
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

/**
 * Stands in for `requireUser`, `requireTeam`, and `i18n` by seeding the
 * context fields they would otherwise populate, plus `Auth`.
 */
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

	test("offers a flow monitor as a selectable service, without its spec source", async () => {
		let { db, team, membership } = await createFixture();

		await db.create(
			flowMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Sign in and load the dashboard",
				source:
					'test "a member can sign in" {\n\twhen {\n\t\tlet session = http.post "https://app.example.com/login" form { password: "hunter2" }\n\t}\n}',
				interval_seconds: 3_600,
			},
			{ touch: true, returnRow: true },
		);

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
		let body = await response.text();

		expect(body).toContain("Sign in and load the dashboard");
		expect(body).toContain("flow_monitor_ids");
		expect(body).not.toContain("hunter2");
	});

	test("posts every field to the create action from one form", async () => {
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
		let body = await response.text();

		expect(body).toContain(
			`action="${routes.actions.statusPage.create.href({ team: team.slug })}"`,
		);
		for (let name of ["name", "slug", "title", "description", "logo_url"]) {
			expect(body).toContain(`name="${name}"`);
		}
		expect(body).toContain(`name="is_public"`);
		expect(body).toContain(`name="show_overall_status"`);
	});

	test("labels the monitor list as a group and gives it a select-all control", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
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
		let body = await response.text();

		/** The select-all control drives the list by id, so the two ids must stay in step. */
		expect(body).toContain(`id="status-page-monitors-group"`);
		expect(body).toContain(`aria-labelledby="status-page-monitors-label"`);
		expect(body.indexOf("Select which monitors to display")).toBeLessThan(
			body.indexOf("status-page-monitors-group"),
		);
		/** The select-all control stays presentation-only, so each checkbox still submits under its own name. */
		expect(body).toContain(`name="monitor_ids"`);
	});

	test("keeps two rhythms: fields from the card, grouped switches tighter", async () => {
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
		let body = await (await container.scope(() => router.fetch(request))).text();

		/**
		 * The card states the field rhythm once via a single gap rule, since a
		 * per-field trailing margin would double the gap before that field; the body
		 * pads all four edges, and the two visibility switches keep a tighter group gap.
		 */
		expect(body.match(/gap: 28px;/g)).toEqual(["gap: 28px;"]);
		expect(body).not.toContain("margin-block-end: 28px");
		expect(body).toContain("padding: calc(var(--ui-spacing, 0.25rem) * 6);");
		expect(body).toContain("gap: calc(var(--ui-spacing, 0.25rem) * 4);");
	});
});
