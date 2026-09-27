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

import type { ManagementClient } from "@sdxc/auth/management-client";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { SubjectNotFoundError } from "@sdxc/auth/management-client";
import { createTranslator } from "@sdxc/i18n";
import { failure } from "@sdxc/result";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import Invite from "~/app/data/invite";
import TeamDomain from "~/app/data/team-domain";
import { admin } from "~/app/http/middleware/admin";
import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import * as settingsModule from "./settings";

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

let { intl } = createTranslator({
	resources: { en },
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
		ctx.intl = intl;
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

/** Renders the settings page, after an earlier request flashed `rejectedLogo` when given. */
async function renderSettings(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	rejectedLogo?: string,
) {
	let fakeAdmin = {
		fetchSubjectById: vi.fn(async (subjectId: string) =>
			failure(new SubjectNotFoundError(subjectId)),
		),
	} as unknown as ManagementClient;

	let router = createRouter({
		middleware: [
			asyncContext(),
			database(() => db),
			admin(() => fakeAdmin),
			session(sessionCookie, sessionStorage),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});
	router.post("/flash", (ctx) => {
		ctx.get(Session)?.flash(settingsModule.TEAM_LOGO_ERROR, rejectedLogo);
		return new Response(null, { status: 204 });
	});
	router.map(routes.app.team.settings, {
		middleware: [seedTeam(team, membership)],
		handler: (settingsModule.default as { handler: RequestHandler<any> }).handler,
	});

	let cookie = "";
	if (rejectedLogo !== undefined) {
		let flashed = await router.fetch(new Request("https://uptime.test/flash", { method: "POST" }));
		cookie = flashed.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; ");
	}

	let request = new Request(
		new URL(routes.app.team.settings.href({ team: team.slug }), "https://uptime.test"),
		cookie ? { headers: { Cookie: cookie } } : undefined,
	);
	return router.fetch(request);
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

	test("refills a rejected logo and shows the field's error beside it", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await renderSettings(db, team, ownerMembership, "acme-logo");
		let body = await response.text();

		let input = body.match(/<input[^>]*name="logo"[^>]*>/)?.[0];
		expect(input).toContain(`value="acme-logo"`);
		expect(input).toContain(`aria-invalid="true"`);
		expect(input).toContain(`aria-describedby="team-logo-error"`);
		expect(body).toContain(`id="team-logo-error"`);
		expect(body).toContain(en.page.settings.form.fields.logo.error);
	});

	test("shows no logo error on a plain visit", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await renderSettings(db, team, ownerMembership);
		let body = await response.text();

		expect(body).not.toContain(`id="team-logo-error"`);
		expect(body.match(/<input[^>]*name="logo"[^>]*>/)?.[0]).not.toContain("aria-invalid");
	});

	test("draws a stored URL logo as an image", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let withLogo = { ...team, logo: "https://example.com/logo.png" };

		let response = await renderSettings(db, withLogo, ownerMembership);
		let body = await response.text();

		expect(body).toMatch(/<img[^>]*src="https:\/\/example\.com\/logo\.png"/);
	});

	test("draws no image for a legacy logo that is not a URL, keeping it in the field", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let legacy = { ...team, logo: "acme-logo" };

		let response = await renderSettings(db, legacy, ownerMembership);
		let body = await response.text();

		expect(body).not.toMatch(/<img[^>]*src="acme-logo"/);
		expect(body.match(/<input[^>]*name="logo"[^>]*>/)?.[0]).toContain(`value="acme-logo"`);
	});

	test("draws no image for a legacy http logo, keeping it in the field", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let legacy = { ...team, logo: "http://example.com/logo.png" };

		let response = await renderSettings(db, legacy, ownerMembership);
		let body = await response.text();

		expect(body).not.toMatch(/<img[^>]*src="http:\/\/example\.com\/logo\.png"/);
		expect(body.match(/<input[^>]*name="logo"[^>]*>/)?.[0]).toContain(
			`value="http://example.com/logo.png"`,
		);
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
