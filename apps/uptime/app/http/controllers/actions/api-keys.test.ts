/**
 * Tests the API-key create/delete actions: a successful create generates and stores
 * a hashed key (capped per team) and redirects to the list; a successful delete
 * removes the key; a rejected create renders the form again with what was submitted, and
 * validation failure and the team-scoped not-found guard leave the `api_keys` table untouched.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Middleware, RequestContext } from "remix/router";

import { database } from "@sdxc/database-middleware";
import { createTranslator } from "@sdxc/i18n";
import { generateUUID } from "@sdxc/uuid/v4";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { apiKeys, memberships, teams } from "~/database/schema";
import en from "~/resources/locales/en";
import routes from "~/routes/web";

let { createApiKey, deleteApiKey } = await import("./api-keys");
let { MAX_API_KEYS_PER_TEAM } = await import("~/app/models/api-keys");

let { intl } = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/**
 * Installs `ctx.team`/`ctx.membership` directly, standing in for `requireTeam`/`requireRole`,
 * plus the viewer and translator a rejected create needs to render the form again.
 */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = [team];
		ctx.locale = "en";
		ctx.intl = intl;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** Minimal request-scoped HTML renderer standing in for the app's `render()` middleware. */
function createHtmlRenderer(ctx: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let stream = renderToStream(node, { frameSrc: ctx.request.url });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
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

/** Posts a form body to one of the API-key actions through the real action and a real database. */
async function postApiKeyAction(
	action: unknown,
	route: { method: string; href: (params: { team: string }) => string },
	team: SelectTeam,
	membership: SelectMembership,
	db: ReturnType<typeof createTestDatabase>["db"],
	body: Record<string, string | string[]>,
) {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			formData(),
			testAssets(),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});
	/**
	 * Casts `router.map` itself so this helper can map several differently-shaped
	 * routes without losing type-checking elsewhere.
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

	return router.fetch(request);
}

async function createTeamRow(db: ReturnType<typeof createTestDatabase>["db"]) {
	return await db.create(
		teams,
		{
			id: generateUUID(),
			owner_id: generateUUID(),
			name: "Acme",
			slug: `acme-${generateUUID()}`,
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
		{ id: generateUUID(), team_id: teamId, subject_id: generateUUID(), role: "admin" },
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
			routes.teamAdminActions.apiKey.create,
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

	test("renders the form again with the typed values when the name is blank, creating no row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postApiKeyAction(
			createApiKey,
			routes.teamAdminActions.apiKey.create,
			team,
			membership,
			db,
			{ name: "", scopes: ["monitors:read", "reports:read"], expires_at: "2030-01-31" },
		);
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body).toContain(en.page.apiKeys.fieldErrors.name);
		expect(body).not.toContain(en.page.apiKeys.fieldErrors.scopes);
		expect(body.match(/<input[^>]*value="monitors:read"[^>]*>/)?.[0]).toMatch(/\schecked\b/);
		expect(body.match(/<input[^>]*value="reports:read"[^>]*>/)?.[0]).toMatch(/\schecked\b/);
		expect(body.match(/<input[^>]*value="monitors:write"[^>]*>/)?.[0]).not.toMatch(/\schecked\b/);
		expect(body).toContain(`value="2030-01-31"`);
		expect(await db.count(apiKeys, { where: { team_id: team.id } })).toBe(0);
	});

	test("keeps the typed name and flags the scopes when none is selected, making no DB mutation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postApiKeyAction(
			createApiKey,
			routes.teamAdminActions.apiKey.create,
			team,
			membership,
			db,
			{ name: "No scopes", scopes: [], expires_at: "" },
		);
		let body = await response.text();

		expect(response.status).toBe(400);
		expect(body.match(/<input[^>]*name="name"[^>]*>/)?.[0]).toContain(`value="No scopes"`);
		expect(body).toContain(en.page.apiKeys.fieldErrors.scopes);
		expect(body).toContain(`aria-describedby="api-key-scopes-error"`);
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
					id: generateUUID(),
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
			routes.teamAdminActions.apiKey.create,
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
				id: generateUUID(),
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
			routes.teamAdminActions.apiKey.delete,
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
				id: generateUUID(),
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
			routes.teamAdminActions.apiKey.delete,
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
				id: generateUUID(),
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
			routes.teamAdminActions.apiKey.delete,
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
