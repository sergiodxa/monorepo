/**
 * Tests for the team dashboard shell. `requireUser`/`requireTeam`/`i18n` are bypassed by
 * seeding `ctx.team`/`ctx.membership`/`ctx.i18next` directly, standing in for a real
 * session cookie, `auth` middleware, and a DB-backed locale lookup. `ctx.render` uses a
 * minimal renderer with a no-op `resolveFrame`, since the dashboard renders `<Frame>`
 * placeholders for monitors and analytics.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import * as dashboardModule from "./dashboard";

/** Stand-in for `renderWith(createHtmlRenderer)`, with `resolveFrame` returning an empty string for this single-request page test. */
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

/**
 * Where each named `Frame` sits in the rendered document. A frame's name never reaches
 * the markup — it is resolved to an id via the hydration data, and the frame itself is a
 * `<!-- rmx:f:id -->` comment, so the id must be looked up before reading any DOM position.
 */
function frameMarkers(body: string): Map<string, number> {
	let data = body.match(/<script type="application\/json" id="rmx-data">(.*?)<\/script>/s);
	let hydration = JSON.parse(data?.[1] ?? "{}") as { f?: Record<string, { name?: string }> };
	let frames = hydration.f ?? {};

	let markers = new Map<string, number>();
	for (let [id, frame] of Object.entries(frames)) {
		if (frame.name) markers.set(frame.name, body.indexOf(`<!-- rmx:f:${id} -->`));
	}

	return markers;
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

describe("app/team/dashboard", () => {
	test("renders the dashboard shell with the header title and the quick check as its action", async () => {
		let { db, team, membership } = await createFixture();

		let router = createRouter({
			middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
		});
		router.map(routes.app.team.dashboard.index, {
			middleware: [seedTeam(team, membership)],
			handler: (dashboardModule.default as { handler: RequestHandler<any> }).handler,
		});

		let container = new ServiceContainer();
		container.instance(Database, db);

		let request = new Request(
			new URL(routes.app.team.dashboard.index.href({ team: team.slug }), "https://uptime.test"),
		);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain(en.page.dashboard.header.title);
	});

	/**
	 * The quick check sits outside `<main>` as the header's action, freeing the stat rows
	 * below to take the full width the fixed column used to occupy. SSL exists as a flag on
	 * an HTTP monitor, so its counting and `+` control belong to the HTTP monitor card.
	 */
	test("puts the quick check in the header, ahead of every stat card and the panel", async () => {
		let { db, team, membership } = await createFixture();

		let router = createRouter({
			middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
		});
		router.map(routes.app.team.dashboard.index, {
			middleware: [seedTeam(team, membership)],
			handler: (dashboardModule.default as { handler: RequestHandler<any> }).handler,
		});

		let container = new ServiceContainer();
		container.instance(Database, db);

		let request = new Request(
			new URL(routes.app.team.dashboard.index.href({ team: team.slug }), "https://uptime.test"),
		);
		let body = await (await container.scope(() => router.fetch(request))).text();

		let markers = frameMarkers(body);
		let quickPing = markers.get("dashboard-quick-ping");
		let usage = markers.get("dashboard-card-usage");
		let cron = markers.get("dashboard-card-count-cron-jobs");
		let panel = markers.get("dashboard-panel");

		expect(quickPing).toBeGreaterThan(-1);
		expect(quickPing).toBeLessThan(body.indexOf("<main"));
		expect(usage).toBeGreaterThan(body.indexOf("<main"));

		expect(cron).toBeGreaterThan(usage!);
		expect(panel).toBeGreaterThan(cron!);

		expect(markers.has("dashboard-card-count-ssl")).toBe(false);
	});

	/**
	 * The bar's two controls render at a fixed 2.5rem height, so that height appearing in
	 * the body confirms the frame streamed behind its own fallback placeholder.
	 */
	test("streams the quick check behind a fallback instead of blocking the document on it", async () => {
		let { db, team, membership } = await createFixture();

		let router = createRouter({
			middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
		});
		router.map(routes.app.team.dashboard.index, {
			middleware: [seedTeam(team, membership)],
			handler: (dashboardModule.default as { handler: RequestHandler<any> }).handler,
		});

		let container = new ServiceContainer();
		container.instance(Database, db);

		let request = new Request(
			new URL(routes.app.team.dashboard.index.href({ team: team.slug }), "https://uptime.test"),
		);
		let body = await (await container.scope(() => router.fetch(request))).text();

		expect(body).toContain("block-size: 2.5rem");
	});

	test("sets the dashboardTab cookie on the response", async () => {
		let { db, team, membership } = await createFixture();

		let router = createRouter({
			middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
		});
		router.map(routes.app.team.dashboard.index, {
			middleware: [seedTeam(team, membership)],
			handler: (dashboardModule.default as { handler: RequestHandler<any> }).handler,
		});

		let container = new ServiceContainer();
		container.instance(Database, db);

		let request = new Request(
			new URL(routes.app.team.dashboard.index.href({ team: team.slug }), "https://uptime.test"),
		);
		let response = await container.scope(() => router.fetch(request));

		expect(response.headers.get("Set-Cookie")).toContain("uptime:dashboard-tab");
	});
});
