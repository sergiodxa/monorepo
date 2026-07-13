/**
 * Tests the API-key create/delete actions: a successful create generates and stores
 * a hashed key (capped per team) and redirects to the list; a successful delete
 * removes the key; validation failure and the team-scoped not-found guard leave the
 * `api_keys` table untouched. *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter, type Middleware } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { apiKeys, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { createApiKey, deleteApiKey } = await import("./api-keys");
let { MAX_API_KEYS_PER_TEAM } = await import("~/app/data/api-key");

/** Installs `ctx.team`/`ctx.membership` directly, standing in for `requireTeam`/`requireRole`. */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		(ctx as unknown as { team: SelectTeam }).team = team;
		(ctx as unknown as { membership: SelectMembership }).membership = membership;
		return next();
	};
}

/** Builds a `URLSearchParams` body, repeating a key once per entry in an array value. */
function toSearchParams(body: Record<string, string | string[]>): URLSearchParams {
	let params = new URLSearchParams();
	for (let [key, value] of Object.entries(body)) {
		if (Array.isArray(value)) {
			for (let entry of value) params.append(key, entry);
		} else {
			params.append(key, value);
		}
	}
	return params;
}

/** Posts a form body to one of the API-key actions through the real action, DB, and service container. */
async function postApiKeyAction(
	action: unknown,
	route: { method: string; href: (params: { team: string }) => string },
	team: SelectTeam,
	membership: SelectMembership,
	db: ReturnType<typeof createTestDatabase>["db"],
	body: Record<string, string | string[]>,
) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let router = createRouter({ middleware: [asyncContext(), formData()] });
	/**
	 * Casts `router.map` itself (rather than its arguments) so this helper can map
	 * several differently-shaped routes without losing type-checking elsewhere.
	 */
	(router.map as (target: unknown, handler: unknown) => void)(route, {
		middleware: [teamContextMiddleware(team, membership)],
		handler: action,
	});

	/** `del(...)` routes (e.g. `delete-api-key`) only match a real HTTP `DELETE` request. */
	let request = new Request(`https://uptime.test${route.href({ team: team.slug })}`, {
		method: route.method,
		body: toSearchParams(body),
		headers: { "content-type": "application/x-www-form-urlencoded" },
	});

	return container.scope(() => router.fetch(request));
}

async function createTeamRow(db: ReturnType<typeof createTestDatabase>["db"]) {
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

async function createMembershipRow(
	db: ReturnType<typeof createTestDatabase>["db"],
	teamId: string,
) {
	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: crypto.randomUUID(), role: "admin" },
		{ touch: true, returnRow: true },
	);
}

describe("POST /actions/:team/create-api-key", () => {
	test("creates an API key with the chosen scopes and redirects to the list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postApiKeyAction(
			createApiKey,
			routes.teamAdminActions.createApiKey,
			team,
			membership,
			db,
			{ name: "CI key", scopes: ["monitors:read", "monitors:write"], expires_at: "" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.apiKeys.index.href({ team: team.slug }),
		);

		let created = await db.findOne(apiKeys, { where: { team_id: team.id } });
		expect(created?.name).toBe("CI key");
		expect(created?.scopes).toEqual(["monitors:read", "monitors:write"]);
		expect(created?.key_hash).toMatch(/^[0-9a-f]{64}$/);
		expect(created?.key_prefix).toHaveLength(15);
	});

	test("rejects a blank name and redirects to the new-key form without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postApiKeyAction(
			createApiKey,
			routes.teamAdminActions.createApiKey,
			team,
			membership,
			db,
			{ name: "", scopes: ["monitors:read"], expires_at: "" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.apiKeys.new.href({ team: team.slug }),
		);
		expect(await db.count(apiKeys, { where: { team_id: team.id } })).toBe(0);
	});

	test("rejects a request with no scopes selected, making no DB mutation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postApiKeyAction(
			createApiKey,
			routes.teamAdminActions.createApiKey,
			team,
			membership,
			db,
			{ name: "No scopes", scopes: [], expires_at: "" },
		);

		expect(response.status).toBe(303);
		expect(await db.count(apiKeys, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 400 once the team is at the per-team API-key cap, without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		for (let i = 0; i < MAX_API_KEYS_PER_TEAM; i++) {
			await db.create(
				apiKeys,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					name: `Key ${i}`,
					scopes: ["monitors:read"],
					expires_at: null,
					key_hash: `hash-${i}`,
					key_prefix: `prefix-${i}`,
					last_used_at: null,
				},
				{ touch: true, returnRow: true },
			);
		}

		let response = await postApiKeyAction(
			createApiKey,
			routes.teamAdminActions.createApiKey,
			team,
			membership,
			db,
			{ name: "One too many", scopes: ["monitors:read"], expires_at: "" },
		);

		expect(response.status).toBe(400);
		expect(await db.count(apiKeys, { where: { team_id: team.id } })).toBe(MAX_API_KEYS_PER_TEAM);
	});
});

describe("DELETE /actions/:team/delete-api-key", () => {
	test("deletes an existing API key and redirects to the list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let apiKey = await db.create(
			apiKeys,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "To delete",
				scopes: ["monitors:read"],
				expires_at: null,
				key_hash: "hash",
				key_prefix: "prefix",
				last_used_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postApiKeyAction(
			deleteApiKey,
			routes.teamAdminActions.deleteApiKey,
			team,
			membership,
			db,
			{ api_key_id: apiKey.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.apiKeys.index.href({ team: team.slug }),
		);
		expect(await db.findOne(apiKeys, { where: { id: apiKey.id } })).toBeNull();
	});

	test("404s when the API key doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let apiKey = await db.create(
			apiKeys,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				name: "Not yours",
				scopes: ["monitors:read"],
				expires_at: null,
				key_hash: "hash",
				key_prefix: "prefix",
				last_used_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postApiKeyAction(
			deleteApiKey,
			routes.teamAdminActions.deleteApiKey,
			team,
			membership,
			db,
			{ api_key_id: apiKey.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(apiKeys, { where: { id: apiKey.id } })).not.toBeNull();
	});

	test("rejects a missing api_key_id and redirects without deleting anything", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let apiKey = await db.create(
			apiKeys,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Still here",
				scopes: ["monitors:read"],
				expires_at: null,
				key_hash: "hash",
				key_prefix: "prefix",
				last_used_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postApiKeyAction(
			deleteApiKey,
			routes.teamAdminActions.deleteApiKey,
			team,
			membership,
			db,
			{ unrelated: "value" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.apiKeys.index.href({ team: team.slug }),
		);
		expect(await db.findOne(apiKeys, { where: { id: apiKey.id } })).not.toBeNull();
	});
});
