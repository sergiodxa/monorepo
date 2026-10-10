/**
 * Tests `DELETE /api/v1/invites/:inviteId` (`inviteDestroy`): revokes a pending
 * invite, gated by a real `requireApiKey` bearer-token check baked into the action.
 * Covers the happy path, rejecting deletion of an already-accepted invite,
 * missing/garbage auth, missing scope, and a uniform 404 for an invite
 * belonging to another team that reveals nothing about its existence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope, SelectTeam } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { checkConformance } from "~/app/lib/test/openapi";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance({ inviteDestroy: null });

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
	let { key } = unwrap(
		await bindModels(db).apiKeys.issue(teamId, { name: "test", scopes, expires_at: null }),
	);
	return key;
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(routes.api.v1.invites.destroy, inviteDestroy);

	return router.fetch(request);
}

function destroyRequest(inviteId: string, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.invites.destroy.href({ inviteId: encodeId("inv", inviteId) })}`,
		{
			method: "DELETE",
			headers,
		},
	);
}

describe("DELETE /api/v1/invites/:inviteId", () => {
	test("revokes a pending invite", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let invite = unwrap(
			await bindModels(db).invites.create({
				team_id: team.id,
				sender_id: team.owner_id,
				email: "pending@example.com",
			}),
		);

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);

		expect(
			await bindModels(db).invites.inTeam(team.id).where({ id: invite.id }).first(),
		).toBeNull();
	});

	test("answers 409 conflict and does not delete an already-accepted invite", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let invite = unwrap(
			await bindModels(db).invites.create({
				team_id: team.id,
				sender_id: team.owner_id,
				email: "accepted@example.com",
			}),
		);
		unwrap(await bindModels(db).invites.accept(invite.id, crypto.randomUUID()));

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: `Bearer ${key}` }),
		);

		await expectProblem(response, "conflict");
		expect(
			await bindModels(db).invites.inTeam(team.id).where({ id: invite.id }).first(),
		).not.toBeNull();
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let invite = unwrap(
			await bindModels(db).invites.create({
				team_id: team.id,
				sender_id: team.owner_id,
				email: "pending@example.com",
			}),
		);

		let response = await dispatch(db, destroyRequest(invite.id));
		expect(response.status).toBe(401);
	});

	test("returns 401 when the Authorization header is garbage", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let invite = unwrap(
			await bindModels(db).invites.create({
				team_id: team.id,
				sender_id: team.owner_id,
				email: "pending@example.com",
			}),
		);

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
		let invite = unwrap(
			await bindModels(db).invites.create({
				team_id: team.id,
				sender_id: team.owner_id,
				email: "pending@example.com",
			}),
		);

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
		let invite = unwrap(
			await bindModels(db).invites.create({
				team_id: otherTeam.id,
				sender_id: otherTeam.owner_id,
				email: "someone-else@example.com",
			}),
		);

		let response = await dispatch(
			db,
			destroyRequest(invite.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(404);
		expect(
			await bindModels(db).invites.inTeam(otherTeam.id).where({ id: invite.id }).first(),
		).not.toBeNull();
	});

	test("answers validation-error for a raw UUID in place of the invite id", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let invite = unwrap(
			await bindModels(db).invites.create({
				team_id: team.id,
				sender_id: team.owner_id,
				email: "pending@example.com",
			}),
		);

		let response = await dispatch(
			db,
			new Request(
				`https://uptime.test${routes.api.v1.invites.destroy.href({ inviteId: invite.id })}`,
				{ method: "DELETE", headers: { Authorization: `Bearer ${key}` } },
			),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "validationError");
		expect(
			await bindModels(db).invites.inTeam(team.id).where({ id: invite.id }).first(),
		).not.toBeNull();
	});
});
