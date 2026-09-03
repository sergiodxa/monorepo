/**
 * Tests for the status pages list controller. No `cloudflare:workers` mock is
 * needed — this controller only imports `~/app/data/status-page`, which has no
 * Cloudflare dependency. `requireUser`/`requireTeam`/`i18n` are bypassed the same
 * way `monitors.test.ts` bypasses auth: a stand-in middleware seeds
 * `ctx.team`/`ctx.membership`/`ctx.i18next` directly, and `ctx.render` is backed by
 * a minimal renderer mirroring `bootstrap/app.tsx`'s `createHtmlRenderer`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createTranslator } from "@sdxc/i18n";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, statusPages, teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: statusPagesAction } = await import("./status-pages");

/**
 * `createAction` returns a union TypeScript can't narrow to the object arm
 * statically, even though this controller is always defined that way at
 * runtime, so this assertion makes `.handler` accessible below.
 */
let statusPagesModule = statusPagesAction as unknown as { handler: RequestHandler<any> };

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

/** Sends a GET request through a minimal router mapping the status pages list route. */
async function get(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.statusPages.index, {
		middleware: [seedTeam(team, membership)],
		handler: statusPagesModule.handler,
	});

	let request = new Request(
		new URL(routes.app.team.statusPages.index.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

describe("GET /app/:team/status-pages", () => {
	test("renders the empty state when the team has no status pages", async () => {
		let { db, team, membership } = await createFixture();

		let response = await get(db, team, membership);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Status Pages");
		expect(body).toContain("No status pages yet");
		expect(body).toContain("Create a status page to share your system status with your users.");
		expect(body).toContain("Create Status Page");
	});

	test("lists a public status page with its name, slug, and visibility badge", async () => {
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

		let response = await get(db, team, membership);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Status Pages");
		expect(body).toContain(page.name);
		expect(body).toContain(page.slug);
		expect(body).toContain("Public");
	});

	test("shows the private visibility badge for a non-public status page", async () => {
		let { db, team, membership } = await createFixture();

		await db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Internal Status",
				slug: "internal-status",
				title: "Internal Status",
				description: null,
				logo_url: null,
				custom_domain: null,
				is_public: false,
				show_overall_status: true,
			},
			{ touch: true, returnRow: true },
		);

		let response = await get(db, team, membership);

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Private");
	});
});
