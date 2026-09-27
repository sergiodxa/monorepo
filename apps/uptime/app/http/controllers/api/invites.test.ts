/**
 * Tests the `/api/v1/invites` collection endpoints: listing invites for a
 * team and creating a pending one, both gated by a real `requireApiKey`
 * bearer-token check. Creating an invite only inserts a row. Covers the
 * happy paths, validation failures, auth failures, and that a list stays
 * scoped to the calling team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import Invite from "~/app/data/invite";
import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import { markInFlight } from "~/app/lib/test/idempotency";
import { checkConformance } from "~/app/lib/test/openapi";
import { parseLink } from "~/app/lib/test/paging";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { teams } from "~/database/schema";
import { invitesRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(invitesRoutes);

let { default: invitesController } = await import("./invites");

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
	let router = createRouter({ middleware: [CONFORMANCE, asyncContext(), database(() => db)] });
	router.map(invitesRoutes, invitesController);

	return router.fetch(request);
}

function indexRequest(
	headers: Record<string, string> = {},
	path: string = routes.api.v1.invites.index.href(),
) {
	return new Request(`https://uptime.test${path}`, { headers });
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

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:read"]);
		let auth = { Authorization: `Bearer ${key}` };

		await Invite.create(db, team.id, team.owner_id, "first@example.com");
		await Invite.create(db, team.id, team.owner_id, "second@example.com");

		let response = await dispatch(
			db,
			indexRequest(auth, `${routes.api.v1.invites.index.href()}?perPage=1`),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { invites: { email: string }[] } };
		expect(body.data.invites).toHaveLength(1);

		// Navigation rides in the headers, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, indexRequest(auth, next as string));
		expect(second.status).toBe(200);
		let secondBody = (await second.json()) as { data: { invites: { email: string }[] } };
		expect(secondBody.data.invites).toHaveLength(1);
		expect(secondBody.data.invites[0]?.email).not.toBe(body.data.invites[0]?.email);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:read"]);

		let response = await dispatch(
			db,
			indexRequest(
				{ Authorization: `Bearer ${key}` },
				`${routes.api.v1.invites.index.href()}?cursor=not-a-cursor`,
			),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "badRequest");
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

describe("GET /api/v1/invites total", () => {
	test("counts every invite on the team, not just the page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:read"]);
		await Invite.create(db, team.id, team.owner_id, "first@example.com");
		await Invite.create(db, team.id, team.owner_id, "second@example.com");
		await Invite.create(db, team.id, team.owner_id, "third@example.com");
		// An invite the key cannot see must not reach the total either.
		await Invite.create(db, otherTeam.id, otherTeam.owner_id, "theirs@example.com");

		let response = await dispatch(
			db,
			indexRequest(
				{ Authorization: `Bearer ${key}` },
				`${routes.api.v1.invites.index.href()}?perPage=1`,
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { invites: unknown[] };
			meta: { pagination: { total: number } };
		};
		expect(body.data.invites).toHaveLength(1);
		expect(body.meta.pagination.total).toBe(3);
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
		expect(body.data.invite.teamId).toBe(encodeId("team", team.id));

		let created = await Invite.findByEmailForTeam(db, team.id, "new@example.com");
		expect(created).not.toBeNull();
	});

	test("answers 409 conflict for an email the team already invited, pending or accepted", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		await Invite.create(db, team.id, team.owner_id, "pending@example.com");
		let accepted = await Invite.create(db, team.id, team.owner_id, "accepted@example.com");
		await Invite.accept(db, accepted.id, team.id, crypto.randomUUID());

		for (let email of ["pending@example.com", "accepted@example.com"]) {
			let response = await dispatch(
				db,
				createRequest({ email }, { Authorization: `Bearer ${key}` }),
			);
			await expectProblem(response, "conflict");
		}
		expect((await Invite.listByTeam(db, team.id)).length).toBe(2);
	});

	test("invites an email another team already invited", async () => {
		let { db } = createTestDatabase();
		let otherTeam = await createTeamRow(db);
		await Invite.create(db, otherTeam.id, otherTeam.owner_id, "shared@example.com");
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);

		let response = await dispatch(
			db,
			createRequest({ email: "shared@example.com" }, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(201);
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
		await expectProblem(response, "validationError");
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

describe("POST /api/v1/invites with an Idempotency-Key", () => {
	test("a retry with the same key replays the first response and creates one invite", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let headers = { Authorization: `Bearer ${key}`, "Idempotency-Key": '"retry-1"' };

		let first = await dispatch(db, createRequest({ email: "new@example.com" }, headers));
		let second = await dispatch(db, createRequest({ email: "new@example.com" }, headers));

		expect(first.status).toBe(201);
		expect(second.status).toBe(201);
		expect(await second.json()).toEqual(await first.json());
		expect((await Invite.listByTeam(db, team.id)).length).toBe(1);
	});

	test("a retry while the first request runs answers idempotency-key-in-use", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let headers = { Authorization: `Bearer ${key}`, "Idempotency-Key": '"in-flight"' };

		await dispatch(db, createRequest({ email: "new@example.com" }, headers));
		await markInFlight(db);
		let response = await dispatch(db, createRequest({ email: "new@example.com" }, headers));

		expect(response.status).toBe(409);
		expect(response.headers.get("Retry-After")).toBe("1");
		await expectProblem(response, "idempotencyKeyInUse");
		expect((await Invite.listByTeam(db, team.id)).length).toBe(1);
	});

	test("reusing a key for a different body answers idempotency-key-reused", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let headers = { Authorization: `Bearer ${key}`, "Idempotency-Key": '"reuse-1"' };

		await dispatch(db, createRequest({ email: "a@example.com" }, headers));
		let response = await dispatch(db, createRequest({ email: "b@example.com" }, headers));

		expect(response.status).toBe(422);
		await expectProblem(response, "idempotencyKeyReused");
		expect((await Invite.listByTeam(db, team.id)).length).toBe(1);
	});

	test("an unquoted key answers idempotency-key-invalid and creates nothing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["invites:write"]);
		let headers = { Authorization: `Bearer ${key}`, "Idempotency-Key": "unquoted" };

		let response = await dispatch(db, createRequest({ email: "new@example.com" }, headers));

		expect(response.status).toBe(400);
		await expectProblem(response, "idempotencyKeyInvalid");
		expect((await Invite.listByTeam(db, team.id)).length).toBe(0);
	});
});
