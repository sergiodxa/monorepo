/**
 * Tests the `/api/v1/alerts` collection endpoints: `GET` lists only the calling
 * team's alerts with channel config stripped, and `POST` creates one for the
 * email/webhook/slack/discord strategy, enforcing the per-team alert cap. Every
 * action is guarded by `requireApiKey`, so each test authenticates with a real
 * bearer key minted through `ApiKey.create`, exercising that same middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { alerts, dnsMonitors, monitors, teams } from "~/database/schema";

/**
 * `~/app/data/monitor`, imported transitively for `monitorId` validation,
 * reads `env` from `cloudflare:workers` at module load, so this mock must
 * also resolve here, alongside the repo-root `bunfig.toml` preload.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: alertsController, alertsRoutes } = await import("./alerts");

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db) {
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

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[]) {
	let { key } = await ApiKey.create(db, teamId, { name: "test key", scopes, expires_at: null });
	return key;
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(alertsRoutes, alertsController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function get(key: string | null) {
	return new Request(`https://uptime.test${alertsRoutes.alertsIndex.href()}`, {
		method: "GET",
		headers: key ? { Authorization: `Bearer ${key}` } : {},
	});
}

function post(key: string | null, body: unknown) {
	return new Request(`https://uptime.test${alertsRoutes.alertsCreate.href()}`, {
		method: "POST",
		headers: {
			...(key ? { Authorization: `Bearer ${key}` } : {}),
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

function emailAlertBody(overrides: Record<string, unknown> = {}) {
	return { strategy: "email", name: "Site down", email: "ops@example.com", ...overrides };
}

describe("GET /api/v1/alerts", () => {
	test("lists only the calling team's alerts", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);

		await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Mine",
				notify_on_recovery: true,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "a@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				monitor_id: null,
				name: "Not mine",
				notify_on_recovery: true,
				cooldown_minutes: 0,
				config: { strategy: "email", config: { to: "b@example.com", subjectPrefix: "" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(db, get(key));
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { alerts: Array<{ name: string }> } };
		expect(body.data.alerts).toHaveLength(1);
		expect(body.data.alerts[0]?.name).toBe("Mine");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, get(null));
		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			new Request(`https://uptime.test${alertsRoutes.alertsIndex.href()}`, {
				method: "GET",
				headers: { Authorization: "Bearer not-a-real-key" },
			}),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, get(key));
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/alerts", () => {
	test("creates an email-strategy alert and returns 201", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody()));
		expect(response.status).toBe(201);

		let body = (await response.json()) as { data: { alert: { id: string; name: string } } };
		expect(body.data.alert.name).toBe("Site down");

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.config).toEqual({
			strategy: "email",
			config: { to: "ops@example.com", subjectPrefix: "" },
		});
	});

	test("returns 400 when the payload fails validation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody({ name: "" })));
		expect(response.status).toBe(400);

		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 404 when monitorId doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(
			db,
			post(key, emailAlertBody({ monitorId: crypto.randomUUID() })),
		);
		expect(response.status).toBe(404);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	/**
	 * `monitorId` shipped alone, when an id could only mean an HTTP monitor. A client still
	 * sending one must keep getting exactly that, or its alert would silently change scope.
	 */
	test("reads a monitorId with no monitorType as an HTTP monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: crypto.randomUUID(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(db, post(key, emailAlertBody({ monitorId: monitor.id })));
		expect(response.status).toBe(201);

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("http");
		expect(created?.monitor_id).toBe(monitor.id);
	});

	test("creates a type-scoped alert from monitorType alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody({ monitorType: "dns" })));
		expect(response.status).toBe(201);

		let body = (await response.json()) as { data: { alert: { monitorType: string | null } } };
		expect(body.data.alert.monitorType).toBe("dns");

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("dns");
		expect(created?.monitor_id).toBeNull();
	});

	test("creates an alert scoped to one DNS monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Domain", domain: "example.com" },
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(
			db,
			post(key, emailAlertBody({ monitorType: "dns", monitorId: monitor.id })),
		);
		expect(response.status).toBe(201);

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("dns");
		expect(created?.monitor_id).toBe(monitor.id);
	});

	test("returns 404 when the monitorId belongs to a different monitor type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: crypto.randomUUID(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(
			db,
			post(key, emailAlertBody({ monitorType: "dns", monitorId: monitor.id })),
		);
		expect(response.status).toBe(404);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 400 for a monitorType outside the supported set", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody({ monitorType: "pigeon" })));
		expect(response.status).toBe(400);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 400 once the team is at the per-team alert cap", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		for (let i = 0; i < MAX_ALERTS_PER_TEAM; i++) {
			await db.create(
				alerts,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					monitor_id: null,
					name: `Alert ${i}`,
					notify_on_recovery: true,
					cooldown_minutes: 0,
					config: { strategy: "email", config: { to: "a@example.com", subjectPrefix: "" } },
				},
				{ touch: true, returnRow: true },
			);
		}

		let response = await dispatch(db, post(key, emailAlertBody()));
		expect(response.status).toBe(400);

		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("LIMIT_EXCEEDED");
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(MAX_ALERTS_PER_TEAM);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, post(null, emailAlertBody()));
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);

		let response = await dispatch(db, post(key, emailAlertBody()));
		expect(response.status).toBe(403);
	});
});
