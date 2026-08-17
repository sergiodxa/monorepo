/**
 * Tests `DELETE /api/v1/invites/:inviteId` (`inviteDestroy`): revokes a pending
 * invite, gated by a real `requireApiKey` bearer-token check baked into the action.
 * Covers the happy path, rejecting deletion of an already-accepted invite,
 * missing/garbage auth, missing scope, and that an invite belonging to another team
 * always 404s rather than 403ing or leaking the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import Invite from "~/app/data/invite";
import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

let { inviteDestroy } = await import("./invite");

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db): Promise<SelectTeam> {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[]): Promise<string> {
	let { key } = await ApiKey.create(db, teamId, { name: "test", scopes, expires_at: null });
	return key;
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.api.v1.invites.destroy, inviteDestroy);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function destroyRequest(inviteId: string, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.invites.destroy.href({ inviteId })}`, {
		method: "DELETE",
		headers,
	});
}

describe("DELETE /api/v1/invites/:inviteId", () => {
	test("revokes a pending invite", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let invite = await Invite.create(db, team.id, team.owner_id, "pending@example.com");

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);

		expect(await Invite.findByIdForTeam(db, team.id, invite.id)).toBeNull();
	});

	test("returns 400 and does not delete an already-accepted invite", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let invite = await Invite.create(db, team.id, team.owner_id, "accepted@example.com");
		await Invite.accept(db, invite.id, team.id, crypto.randomUUID());

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(await Invite.findByIdForTeam(db, team.id, invite.id)).not.toBeNull();
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let invite = await Invite.create(db, team.id, team.owner_id, "pending@example.com");

		let response = await dispatch(db, destroyRequest(invite.id));
		expect(response.status).toBe(401);
	});

	test("returns 401 when the Authorization header is garbage", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let invite = await Invite.create(db, team.id, team.owner_id, "pending@example.com");

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: "Bearer not-a-real-key" }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the invites:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:read"]);
		let invite = await Invite.create(db, team.id, team.owner_id, "pending@example.com");

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});

	test("404s when the invite doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let invite = await Invite.create(
			db,
			otherTeam.id,
			otherTeam.owner_id,
			"someone-else@example.com",
		);

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(404);
		expect(await Invite.findByIdForTeam(db, otherTeam.id, invite.id)).not.toBeNull();
	});
});
