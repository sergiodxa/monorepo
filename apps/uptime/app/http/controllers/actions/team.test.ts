/**
 * Tests for team settings/membership actions: update/delete a team (delete is
 * owner-only in the handler itself, and ends the owner's subscriptions before
 * cascading the delete), and remove/promote-or-demote a member (both reject
 * targeting the team owner, and change-role 404s for a membership that doesn't
 * exist).
 *
 * The platform is a real in-memory one, so a deletion's effect on billing is read
 * back from it rather than asserted against recorded calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementClient } from "@sdxc/auth/management-client";
import type { MemoryBilling } from "@sdxc/billing/providers/memory";
import type { RemixNode } from "remix/component";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import { SubjectNotFoundError } from "@sdxc/auth/management-client";
import billing from "@sdxc/billing/middleware";
import { database } from "@sdxc/database-middleware";
import { createTranslator } from "@sdxc/i18n";
import { log } from "@sdxc/logger/middleware";
import { failure, unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { renderToStream } from "remix/component/server";
import { createCookie } from "remix/cookie";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { teamAccess } from "~/app/http/middleware/access";
import { admin } from "~/app/http/middleware/admin";
import models from "~/app/http/middleware/models";
import { MONITORING_PRODUCT } from "~/app/initializers/billing";
import { createTestBilling } from "~/app/test/billing";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { memberships, teams } from "~/database/schema";
import en from "~/resources/locales/en";
import routes from "~/routes/web";

/** The delete action's own logging is noise here; the assertions read the response. */
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "info").mockImplementation(() => {});

/**
 * `@sdxc/validate`'s `validate()` flattens `FormData`/`URLSearchParams` into a plain
 * object, but this app's schemas validate raw form data directly and reject a
 * flattened one — a known bug this mock works around so tests exercise real branching.
 */
let { changeRole, deleteTeam, removeMember, updateTeam } = await import("./team");

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

let { intl } = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** Minimal request-scoped HTML renderer standing in for the app's `render()` middleware. */
function createHtmlRenderer(ctx: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/**
 * Posts the update-team form through a router carrying everything the settings page needs
 * to render, since a rejected submission answers with that page rather than a redirect. The
 * management client knows no subject, so members render by their raw id.
 */
async function sendUpdate(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	params: Record<string, string>,
): Promise<Response> {
	let fakeAdmin = {
		fetchSubjectById: vi.fn(async (subjectId: string) =>
			failure(new SubjectNotFoundError(subjectId)),
		),
	} as unknown as ManagementClient;
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};

	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			admin(() => fakeAdmin),
			session(sessionCookie, sessionStorage),
			formData() as Middleware,
			testAssets(),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});
	router.map(routes.teamAdminActions.team.update, {
		middleware: [
			(ctx, next) => {
				ctx.teams = [team];
				ctx.locale = "en";
				ctx.intl = intl;
				ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
				return next();
			},
			seedTeam(team, membership),
		],
		handler: updateTeam as RequestHandler<any>,
	});

	return router.fetch(
		new Request(
			new URL(routes.teamAdminActions.team.update.href({ team: team.slug }), "https://uptime.test"),
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams(params).toString(),
			},
		),
	);
}

/** Creates an in-memory database seeded with an owner and one additional member. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: generateUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let ownerMembership = await db.create(
		memberships,
		{ id: generateUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);
	let memberMembership = await db.create(
		memberships,
		{ id: generateUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);

	return { db, team, ownerMembership, memberMembership };
}

/** Middleware that seeds `ctx.team`/`ctx.membership` for tests; production resolves them via `requireTeam`/`requireRole`. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		return teamAccess(ctx, next);
	};
}

/**
 * Sells the monitoring subscription to `externalId`, so a deletion has something real to
 * end and a refused deletion has something to still be holding afterwards.
 */
async function subscribe(platform: MemoryBilling, externalId: string): Promise<void> {
	let customer = await unwrap(
		platform.customers.create({ email: `${externalId}@example.com`, externalId }),
	);
	let opened = await unwrap(
		platform.checkouts.create({ product: MONITORING_PRODUCT, customer: { id: customer.id } }),
	);
	await unwrap(platform.checkouts.finish(opened.id));
}

/** Every status the platform now holds for `externalId`, which is what a cancellation moves. */
async function statusesFor(platform: MemoryBilling, externalId: string): Promise<string[]> {
	let listed = await unwrap(platform.subscriptions.list({ customer: { externalId } }));
	return listed.items.map((subscription) => subscription.status);
}

/** Sends a form request through a minimal router mapping a single action route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	platform: MemoryBilling,
	route: Route,
	handler: RequestHandler<any>,
	method: string,
	params: Record<string, string>,
): Promise<Response> {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			log() as Middleware,
			billing({ provider: platform }),
			session(sessionCookie, sessionStorage),
			formData() as Middleware,
		],
	});
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return router.fetch(request);
}

describe("updateTeam", () => {
	test("updates the team's name/logo and redirects to team settings", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.team.update,
			updateTeam as RequestHandler<any>,
			"POST",
			{ name: "Acme Renamed", logo: "https://example.com/logo.png" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.name).toBe("Acme Renamed");
		expect(updated?.logo).toBe("https://example.com/logo.png");
	});

	test("renders the settings page again with the typed values when the name is blank", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await sendUpdate(db, team, ownerMembership, {
			name: "",
			logo: "https://example.com/typed.png",
		});
		let body = await response.text();

		expect(response.status).toBe(400);
		let nameInput = body.match(/<input[^>]*name="name"[^>]*>/)?.[0];
		expect(nameInput).toContain(`aria-invalid="true"`);
		expect(nameInput).toContain(`aria-describedby="team-name-error"`);
		expect(body).toContain(en.page.settings.fieldErrors.name);
		expect(body.match(/<input[^>]*name="logo"[^>]*>/)?.[0]).toContain(
			`value="https://example.com/typed.png"`,
		);

		let unchanged = await db.findOne(teams, { where: { id: team.id } });
		expect(unchanged?.name).toBe("Acme");
	});

	test("rejects a logo that is not a URL and keeps it in the field beside its error", async () => {
		let { db, team, ownerMembership } = await createFixture();

		let response = await sendUpdate(db, team, ownerMembership, {
			name: "Acme Renamed",
			logo: "acme-logo",
		});
		let body = await response.text();

		expect(response.status).toBe(400);
		let logoInput = body.match(/<input[^>]*name="logo"[^>]*>/)?.[0];
		expect(logoInput).toContain(`value="acme-logo"`);
		expect(logoInput).toContain(`aria-invalid="true"`);
		expect(logoInput).toContain(`aria-describedby="team-logo-error"`);
		expect(body).toContain(`id="team-logo-error"`);
		expect(body).toContain(en.page.settings.form.fields.logo.error);
		expect(body.match(/<input[^>]*name="name"[^>]*>/)?.[0]).toContain(`value="Acme Renamed"`);

		let unchanged = await db.findOne(teams, { where: { id: team.id } });
		expect(unchanged?.name).toBe("Acme");
		expect(unchanged?.logo).toBeNull();
	});

	test("clears the logo when the field is submitted empty", async () => {
		let { db, team, ownerMembership } = await createFixture();
		await db.update(teams, team.id, { logo: "https://example.com/logo.png" });
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.team.update,
			updateTeam as RequestHandler<any>,
			"POST",
			{ name: "Acme", logo: "" },
		);

		expect(response.status).toBe(303);

		let updated = await db.findOne(teams, { where: { id: team.id } });
		expect(updated?.logo).toBeNull();
	});
});

describe("deleteTeam", () => {
	test("rejects deletion from a non-owner admin without touching billing or the team", async () => {
		let { db, team, memberMembership } = await createFixture();
		let platform = createTestBilling();
		await subscribe(platform, team.owner_id);

		let response = await send(
			db,
			team,
			memberMembership,
			platform,
			routes.teamAdminActions.team.delete,
			deleteTeam as RequestHandler<any>,
			"DELETE",
			{ confirmation: "Acme" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Only the team owner");
		expect(await statusesFor(platform, team.owner_id)).toEqual(["active"]);
		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
	});

	test("rejects a confirmation that is not the team's exact name without deleting the team", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.team.delete,
			deleteTeam as RequestHandler<any>,
			"DELETE",
			{ confirmation: "acme" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("to confirm");
		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
	});

	test("cancels the owner's active subscriptions and deletes the team", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let platform = createTestBilling();
		await subscribe(platform, team.owner_id);

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.team.delete,
			deleteTeam as RequestHandler<any>,
			"DELETE",
			{ confirmation: "Acme" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());

		expect(await statusesFor(platform, team.owner_id)).toEqual(["canceled"]);

		expect(await db.findOne(teams, { where: { id: team.id } })).toBeNull();
		let remainingMemberships = await db.findMany(memberships, { where: { team_id: team.id } });
		expect(remainingMemberships).toHaveLength(0);
	});
});

describe("removeMember", () => {
	test("removes the member and redirects to team settings", async () => {
		let { db, team, ownerMembership, memberMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.member.remove,
			removeMember as RequestHandler<any>,
			"DELETE",
			{ subject_id: "member-1", email: "member@example.com" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		expect(await db.findOne(memberships, { where: { id: memberMembership.id } })).toBeNull();
	});

	test("rejects removing the team owner without deleting their membership", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.member.remove,
			removeMember as RequestHandler<any>,
			"DELETE",
			{ subject_id: "owner-1", email: "owner@example.com" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("owner can't be removed");

		expect(await db.findOne(memberships, { where: { id: ownerMembership.id } })).not.toBeNull();
	});

	test("redirects back without removing anyone when the form is missing fields", async () => {
		let { db, team, ownerMembership, memberMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.member.remove,
			removeMember as RequestHandler<any>,
			"DELETE",
			{},
		);

		expect(response.status).toBe(303);
		expect(await db.findOne(memberships, { where: { id: memberMembership.id } })).not.toBeNull();
	});
});

describe("changeRole", () => {
	test("changes the member's role and redirects to team settings", async () => {
		let { db, team, ownerMembership, memberMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.member.changeRole,
			changeRole as RequestHandler<any>,
			"POST",
			{ subject_id: "member-1", role: "admin" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let updated = await db.findOne(memberships, { where: { id: memberMembership.id } });
		expect(updated?.role).toBe("admin");
	});

	test("rejects changing the team owner's role without mutating it", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.member.changeRole,
			changeRole as RequestHandler<any>,
			"POST",
			{ subject_id: "owner-1", role: "member" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("owner's role can't be changed");

		let unchanged = await db.findOne(memberships, { where: { id: ownerMembership.id } });
		expect(unchanged?.role).toBe("admin");
	});

	test("responds 404 when the target subject has no membership on the team", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let platform = createTestBilling();

		let response = await send(
			db,
			team,
			ownerMembership,
			platform,
			routes.teamAdminActions.member.changeRole,
			changeRole as RequestHandler<any>,
			"POST",
			{ subject_id: generateUUID(), role: "admin" },
		);

		expect(response.status).toBe(404);
	});
});
