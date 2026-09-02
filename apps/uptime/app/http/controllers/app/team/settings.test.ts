/**
 * Tests for the team settings page controller. No `cloudflare:workers` mock is
 * needed since this controller only touches `~/app/data/invite`, `~/app/data/team`,
 * `~/app/data/team-domain`, and `~/app/services/subjects`, none of which depend on
 * a queue binding. A fake `ManagementClient` answers that it holds no record for the
 * seeded members, so the page renders them by raw `subject_id`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ManagementClient, SubjectNotFoundError } from "@pkg/auth/management-client";
import { createTranslator } from "@pkg/i18n";
import { failure } from "@pkg/result";
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

import Invite from "~/app/data/invite";
import TeamDomain from "~/app/data/team-domain";
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

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

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

	let admin = {
		fetchSubjectById: vi.fn(async (subjectId: string) =>
			failure(new SubjectNotFoundError(subjectId)),
		),
	} as unknown as ManagementClient;
	container.instance(ManagementClient, admin);

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

	test("marks the owner's billing link as a document navigation", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await renderSettings(db, team, ownerMembership);
		let body = await response.text();

		let link = body.match(
			new RegExp(`<a[^>]*href="${routes.app.team.checkout.href({ team: team.slug })}"[^>]*>`),
		);
		expect(link?.[0]).toContain("data-rmx-document");
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

	test("shows an empty state instead of a bare table for pending invitations with none", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await renderSettings(db, team, ownerMembership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.settings.members.invitedTable.empty.description);
		expect(body).not.toContain(en.page.settings.members.invitedTable.columns.expires);
	});

	test("shows an empty state instead of a bare table for verified domains with none", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await renderSettings(db, team, ownerMembership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.settings.domains.table.empty.description);
		expect(body).not.toContain(en.page.settings.domains.table.columns.hostname);
	});

	test("renders the pending invitations and verified domains tables when non-empty", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let invite = await Invite.create(
			db,
			team.id,
			ownerMembership.subject_id,
			"invitee@example.com",
		);
		let domain = await TeamDomain.create(db, team.id, "example.com");

		let response = await renderSettings(db, team, ownerMembership);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.settings.members.invitedTable.columns.expires);
		expect(body).toContain(invite.email);
		expect(body).not.toContain(en.page.settings.members.invitedTable.empty.description);

		expect(body).toContain(en.page.settings.domains.table.columns.hostname);
		expect(body).toContain(domain.hostname);
		expect(body).not.toContain(en.page.settings.domains.table.empty.description);
	});
});
