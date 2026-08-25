/**
 * Integration tests for `requireTeam`, exercising the real `Team.findByIdOrSlug`
 * / `Team.findMembership` lookups plus the real session and auth chain, to verify
 * a member loads their team by id or slug, and a missing team, a non-member, and
 * an anonymous request all resolve to the same 404 — concealing whether the team
 * exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@pkg/service-container";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { describe, expect, test } from "vitest";

import { auth, login, type Viewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";

type Db = ReturnType<typeof createTestDatabase>["db"];

let owner: Viewer = { id: "owner_1", name: "Owner", email: "owner@example.com", avatar: "" };
let outsider: Viewer = {
	id: "outsider_1",
	name: "Outsider",
	email: "outsider@example.com",
	avatar: "",
};

async function seedTeam(db: Db) {
	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: owner.id, name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);

	await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: owner.id, team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	return team;
}

async function dispatch(db: Db, idOrSlug: string, viewer?: Viewer) {
	let cookie = createCookie("test-session", { secrets: ["test-secret"] });
	let storage = createMemorySessionStorage();

	let router = createRouter({
		middleware: [
			asyncContext(),
			session(cookie, storage),
			(_ctx, next) => {
				if (viewer) login(viewer);
				return next();
			},
			auth,
		],
	});

	router.get("/:team", {
		middleware: [requireTeam],
		handler(ctx) {
			return Response.json({ teamId: ctx.team.id, role: ctx.membership.role });
		},
	});

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let request = new Request(`https://example.com/${idOrSlug}`);
	return container.scope(() => router.fetch(request));
}

describe("requireTeam", () => {
	test("resolves the team and membership by id for a member", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);

		let response = await dispatch(db, team.id, owner);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ teamId: team.id, role: "admin" });
	});

	test("resolves the team by slug for a member", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);

		let response = await dispatch(db, "acme", owner);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ teamId: team.id, role: "admin" });
	});

	test("returns 404 for a team that does not exist", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db);

		let response = await dispatch(db, "does-not-exist", owner);

		expect(response.status).toBe(404);
	});

	test("returns 404 (never 403) for a viewer who is not a member of an existing team", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);

		let response = await dispatch(db, team.id, outsider);

		expect(response.status).toBe(404);
	});

	test("returns 404 for an anonymous request to an existing team", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db);

		let response = await dispatch(db, team.id);

		expect(response.status).toBe(404);
	});
});
