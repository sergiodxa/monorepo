/**
 * Tests for team settings/membership actions: update/delete a team (delete is
 * owner-only in the handler itself, and cancels the owner's Polar subscriptions
 * before cascading the delete), and remove/promote-or-demote a member (both reject
 * targeting the team owner, and change-role 404s for a membership that doesn't
 * exist).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { PolarClient } from "@pkg/polar";
import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `@pkg/validate`'s `validate()` flattens `FormData`/`URLSearchParams` into a plain
 * object before handing it to the schema, but `remix/data-schema/form-data`'s
 * `f.object()` (which every schema in this app is built with) validates the raw
 * `FormData`/`URLSearchParams` directly and rejects a flattened object with "Expected
 * FormData or URLSearchParams". As shipped, that means `validate(ctx.formData, ...)`
 * always fails, regardless of whether the submitted data is actually valid — a real,
 * reproducible bug in the shared `@pkg/validate` package (flagged separately). This
 * mock forwards the form container straight to the schema instead of flattening it,
 * so these tests exercise the actions' real branching instead of always hitting the
 * validation-error path; it can be deleted once the real `@pkg/validate` is fixed.
 */
let { changeRole, deleteTeam, removeMember, updateTeam } = await import("./team");

/** Creates an in-memory database seeded with an owner and one additional member. */
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
	let memberMembership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);

	return { db, team, ownerMembership, memberMembership };
}

/** Middleware that seeds `ctx.team`/`ctx.membership` in place of `requireTeam`/`requireRole`. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		return next();
	};
}

/** A fake `PolarClient`, registered on the container in place of the real class. */
function createFakePolar() {
	return {
		listActiveSubscriptions: mock(async () => [
			{ id: "sub_1", productId: "94161883-14eb-42e2-bb26-b4647199cda1", status: "active" },
		]),
		revokeSubscription: mock(async () => ({})),
	};
}

/** Sends a form request through a minimal router mapping a single action route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	polar: ReturnType<typeof createFakePolar>,
	route: Route,
	handler: RequestHandler<any>,
	method: string,
	params: Record<string, string>,
): Promise<Response> {
	let { PolarClient } = await import("@pkg/polar");

	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar as unknown as PolarClient);

	let router = createRouter({ middleware: [asyncContext(), formData() as Middleware] });
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("updateTeam", () => {
	test("updates the team's name/logo and redirects to team settings", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.updateTeam,
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

	test("redirects back without mutating when the name is blank", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.updateTeam,
			updateTeam as RequestHandler<any>,
			"POST",
			{ name: "" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let unchanged = await db.findOne(teams, { where: { id: team.id } });
		expect(unchanged?.name).toBe("Acme");
	});
});

describe("deleteTeam", () => {
	test("rejects deletion from a non-owner admin without touching Polar or the team", async () => {
		let { db, team, memberMembership } = await createFixture();
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			memberMembership,
			polar,
			routes.teamAdminActions.deleteTeam,
			deleteTeam as RequestHandler<any>,
			"DELETE",
			{ confirmation: "DELETE" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Only the team owner");
		expect(polar.listActiveSubscriptions).not.toHaveBeenCalled();
		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
	});

	test("rejects an incorrect confirmation without deleting the team", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.deleteTeam,
			deleteTeam as RequestHandler<any>,
			"DELETE",
			{ confirmation: "delete" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain('Type "DELETE"');
		expect(await db.findOne(teams, { where: { id: team.id } })).not.toBeNull();
	});

	test("cancels the owner's active Polar subscriptions and deletes the team", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.deleteTeam,
			deleteTeam as RequestHandler<any>,
			"DELETE",
			{ confirmation: "DELETE" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());

		expect(polar.listActiveSubscriptions).toHaveBeenCalledWith(
			"owner-1",
			"94161883-14eb-42e2-bb26-b4647199cda1",
		);
		expect(polar.revokeSubscription).toHaveBeenCalledTimes(1);
		expect(polar.revokeSubscription).toHaveBeenCalledWith("sub_1");

		expect(await db.findOne(teams, { where: { id: team.id } })).toBeNull();
		let remainingMemberships = await db.findMany(memberships, { where: { team_id: team.id } });
		expect(remainingMemberships).toHaveLength(0);
	});
});

describe("removeMember", () => {
	test("removes the member and redirects to team settings", async () => {
		let { db, team, ownerMembership, memberMembership } = await createFixture();
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.removeMember,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.removeMember,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.removeMember,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.changeRole,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.changeRole,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.changeRole,
			changeRole as RequestHandler<any>,
			"POST",
			{ subject_id: crypto.randomUUID(), role: "admin" },
		);

		expect(response.status).toBe(404);
	});
});
