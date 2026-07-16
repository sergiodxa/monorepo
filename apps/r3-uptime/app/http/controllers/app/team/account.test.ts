/**
 * Tests for the account page controller. No `cloudflare:workers` mock is needed —
 * this controller only touches `~/app/data/team` and `~/app/data/user-preferences`,
 * neither of which depends on a Workflow binding. `ctx.team`/`ctx.membership`/
 * `Auth`/`ctx.i18next` are seeded directly, standing in for the real
 * `requireUser`/`requireTeam` middleware chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

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
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import * as accountModule from "./account";

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

/** Seeds ctx.team/ctx.membership/ctx.teams/ctx.locale/ctx.i18next + Auth. */
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
		{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);
	return { db, team, membership };
}

async function renderAccount(db: Database, team: SelectTeam, membership: SelectMembership) {
	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.account, {
		middleware: [seedTeam(team, membership)],
		handler: (accountModule.default as { handler: RequestHandler<any> }).handler,
	});

	let container = new ServiceContainer();
	container.instance(Database, db);

	let request = new Request(
		new URL(routes.app.team.account.href({ team: team.slug }), "https://uptime.test"),
	);
	return container.scope(() => router.fetch(request));
}

describe("account page", () => {
	test("renders the account page with the viewer's profile and teams", async () => {
		let { db, team, membership } = await createFixture();

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.account.header.title);
		expect(body).toContain(`mailto:viewer@example.com`);
		expect(body).toContain("viewer@example.com");
		expect(body).toContain(team.name);
	});

	test("shows the Leave button only for a membership where the viewer is a plain member, not the owner", async () => {
		let { db, team, membership } = await createFixture();

		// A second team where the same viewer (owner-1) is a plain member, not the owner.
		let otherTeam = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "someone-else", name: "Beta", slug: "beta", logo: null },
			{ touch: true, returnRow: true },
		);
		await db.create(
			memberships,
			{
				id: crypto.randomUUID(),
				subject_id: membership.subject_id,
				team_id: otherTeam.id,
				role: "member",
			},
			{ touch: true, returnRow: true },
		);

		let response = await renderAccount(db, team, membership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(team.name);
		expect(body).toContain(otherTeam.name);

		let leaveLabel = en.page.account.teams.table.actions.leave;
		let occurrences = body.split(leaveLabel).length - 1;
		// Only the "Beta" row (where the viewer is a plain member) should render the
		// Leave action; the "Acme" row (where the viewer is the owner) should not. A
		// leavable row renders the label twice — once in its row menu, once in its
		// confirmation dialog's submit button.
		expect(occurrences).toBe(2);
	});
});
