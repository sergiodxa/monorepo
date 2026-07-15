/**
 * Tests for the team settings page controller. No `cloudflare:workers` mock is
 * needed — this controller only touches `~/app/data/invite`, `~/app/data/team`,
 * `~/app/data/team-domain`, and `~/app/services/subjects`, none of which depend on a
 * Workflow binding. A fake `AuthSDK` stands in for the real one so
 * `resolveSubjects()` doesn't attempt a real client-credentials call — it's made to
 * fail so the page falls back to rendering members by raw `subject_id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { AuthSDK } from "@pkg/auth-sdk";
import { failure } from "@pkg/result";
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

import * as settingsModule from "./settings";

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
	let ownerMembership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);
	return { db, team, ownerMembership };
}

async function renderSettings(db: Database, team: SelectTeam, membership: SelectMembership) {
	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.settings, {
		middleware: [seedTeam(team, membership)],
		handler: (settingsModule.default as { handler: RequestHandler<any> }).handler,
	});

	let container = new ServiceContainer();
	container.instance(Database, db);

	let authSdk = {
		authenticate: mock(async () => failure(new Error("no auth in tests"))),
	} as unknown as AuthSDK;
	container.instance(AuthSDK, authSdk);

	let request = new Request(
		new URL(routes.app.team.settings.href({ team: team.slug }), "https://uptime.test"),
	);
	return container.scope(() => router.fetch(request));
}

describe("settings page", () => {
	test("renders the settings page with the team's name pre-filled", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await renderSettings(db, team, ownerMembership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.settings.header.title);
		expect(body).toContain(`value="Acme"`);
	});

	test("shows remove/change-role controls only for non-owner members", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let nonOwnerMembership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "member-2", team_id: team.id, role: "member" },
			{ touch: true, returnRow: true },
		);

		let response = await renderSettings(db, team, ownerMembership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(`remove-member-${nonOwnerMembership.id}`);
		expect(body).not.toContain(`remove-member-${ownerMembership.id}`);
	});
});
