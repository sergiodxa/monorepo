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

import type { PolarClient } from "@pkg/polar";
import type { Middleware, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `@pkg/validate`'s `validate()` flattens `FormData`/`URLSearchParams` into a plain
 * object, but this app's schemas validate raw form data directly and reject a
 * flattened one — a known bug this mock works around so tests exercise real branching.
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

/** Middleware that seeds `ctx.team`/`ctx.membership` for tests; production resolves them via `requireTeam`/`requireRole`. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		return next();
	};
}

/** A fake `PolarClient` with mocked `listActiveSubscriptions`/`revokeSubscription`, registered on the container so assertions can inspect the calls made during the test. */
function createFakePolar() {
	return {
		listActiveSubscriptions: vi.fn(async () => [
			{ id: "sub_1", productId: "94161883-14eb-42e2-bb26-b4647199cda1", status: "active" },
		]),
		revokeSubscription: vi.fn(async () => ({})),
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

	test("redirects back without mutating when the name is blank", async () => {
		let { db, team, ownerMembership } = await createFixture();
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.team.update,
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
			routes.teamAdminActions.team.delete,
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
			routes.teamAdminActions.team.delete,
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
			routes.teamAdminActions.team.delete,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
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
		let polar = createFakePolar();

		let response = await send(
			db,
			team,
			ownerMembership,
			polar,
			routes.teamAdminActions.member.changeRole,
			changeRole as RequestHandler<any>,
			"POST",
			{ subject_id: crypto.randomUUID(), role: "admin" },
		);

		expect(response.status).toBe(404);
	});
});
