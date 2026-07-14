/**
 * Tests the `/api/v1/invites` collection endpoints: listing every invite (pending and
 * accepted) for a team and creating a pending one, both gated by a real
 * `requireApiKey` bearer-token check baked into the controller. This endpoint only
 * inserts a row and never sends an email (unlike the web invite flow), so no mail
 * service needs stubbing here. Covers the happy paths, validation failure,
 * missing/garbage auth, missing scope, and that a list never leaks another team's
 * invites.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";

import type { ApiKeyScope, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import Invite from "~/app/data/invite";
import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: invitesController, invitesRoutes } = await import("./invites");

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
	router.map(invitesRoutes, invitesController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function indexRequest(headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.invites.index.href()}`, { headers });
}

function createRequest(body: unknown, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.invites.create.href()}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

describe("GET /api/v1/invites", () => {
	test("lists every invite for the team, pending and accepted", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:read"]);

		let invite = await Invite.create(db, team.id, team.owner_id, "new@example.com");
		await Invite.accept(db, invite.id, team.id, crypto.randomUUID());

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { invites: { email: string; acceptedAt: number | null }[] };
		};
		expect(body.data.invites).toHaveLength(1);
		expect(body.data.invites[0]?.email).toBe("new@example.com");
		expect(body.data.invites[0]?.acceptedAt).not.toBeNull();
	});

	test("only returns the calling team's invites, not another team's", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:read"]);

		await Invite.create(db, team.id, team.owner_id, "mine@example.com");
		await Invite.create(db, otherTeam.id, otherTeam.owner_id, "theirs@example.com");

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));
		let body = (await response.json()) as { data: { invites: { email: string }[] } };
		expect(body.data.invites).toHaveLength(1);
		expect(body.data.invites[0]?.email).toBe("mine@example.com");
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, indexRequest());
		expect(response.status).toBe(401);
	});

	test("returns 401 when the Authorization header is garbage", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, indexRequest({ Authorization: "Bearer not-a-real-key" }));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the invites:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/invites", () => {
	test("creates a pending invite and returns 201 with the created row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);

		let response = await dispatch(
			db,
			createRequest({ email: "new@example.com" }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: { invite: { email: string; acceptedAt: number | null; teamId: string } };
		};
		expect(body.data.invite.email).toBe("new@example.com");
		expect(body.data.invite.acceptedAt).toBeNull();
		expect(body.data.invite.teamId).toBe(team.id);

		let created = await Invite.findByEmailForTeam(db, team.id, "new@example.com");
		expect(created).not.toBeNull();
	});

	test("returns 400 for a validation failure (invalid email)", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);

		let response = await dispatch(
			db,
			createRequest({ email: "not-an-email" }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(await Invite.findByEmailForTeam(db, team.id, "not-an-email")).toBeNull();
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, createRequest({ email: "new@example.com" }));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the invites:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:read"]);

		let response = await dispatch(
			db,
			createRequest({ email: "new@example.com" }, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});
});
