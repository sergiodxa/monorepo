/**
 * Tests the `/api/v1/alerts/:alertId` item endpoints: get/update/delete a single
 * alert scoped to the calling team (never leaking another team's alert, always a
 * 404 instead) and its delivery-event history. Every action is guarded by
 * `requireApiKey`, so each test authenticates with a real bearer key minted through
 * `ApiKey.create` rather than a fake middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { createTestDatabase } from "~/app/lib/test/db";
import { alertEvents, alerts, teams } from "~/database/schema";

/**
 * `~/app/data/monitor` (imported transitively by `./alert`, for its `monitorId`
 * validation) reads `env` from `cloudflare:workers` at module load, so the module has to
 * resolve here as well as through the repo-root `bunfig.toml` preload. These endpoints
 * touch no binding, and the empty strict env proves it: any read would throw by the
 * binding's name instead of quietly answering a stand-in value.
 */
await mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: alertController, alertRoutes } = await import("./alert");

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

async function createAlertRow(db: Db, teamId: string, overrides: Record<string, unknown> = {}) {
	return await db.create(
		alerts,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			monitor_id: null,
			name: "Site down",
			notify_on_recovery: true,
			cooldown_minutes: 0,
			config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "" } },
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(alertRoutes, alertController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function req(method: string, href: string, key: string | null, body?: unknown): Request {
	return new Request(`https://uptime.test${href}`, {
		method,
		headers: {
			...(key ? { Authorization: `Bearer ${key}` } : {}),
			...(body !== undefined ? { "content-type": "application/json" } : {}),
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
}

describe("GET /api/v1/alerts/:alertId", () => {
	test("returns the alert with sensitive config stripped", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { alert: { id: string; name: string } } };
		expect(body.data.alert.id).toBe(alert.id);
		expect(body.data.alert.name).toBe("Site down");
	});

	test("404s when the alert doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: alert.id }), null),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(403);
	});
});

describe("PUT /api/v1/alerts/:alertId", () => {
	test("updates the alert's non-channel fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, {
				name: "Renamed",
				cooldownMinutes: 15,
			}),
		);
		expect(response.status).toBe(200);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.name).toBe("Renamed");
		expect(updated?.cooldown_minutes).toBe(15);
		// The channel strategy/config are immutable via this endpoint.
		expect(updated?.config).toEqual({
			strategy: "email",
			config: { to: "ops@example.com", subjectPrefix: "" },
		});
	});

	test("returns 400 when the payload fails validation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, { name: "" }),
		);
		expect(response.status).toBe(400);

		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");

		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.name).toBe("Site down");
	});

	test("returns 404 when monitorId doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, {
				monitorId: crypto.randomUUID(),
			}),
		);
		expect(response.status).toBe(404);
	});

	test("narrows an alert to a whole monitor type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, {
				monitorType: "dns",
			}),
		);
		expect(response.status).toBe(200);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBe("dns");
		expect(updated?.monitor_id).toBeNull();
	});

	/** The pair moves together, so a type-wide scope can't keep the old monitor's id. */
	test("clears a monitor id when the update names only a type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			monitor_type: "http",
			monitor_id: crypto.randomUUID(),
		});

		await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, {
				monitorType: "cron",
			}),
		);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBe("cron");
		expect(updated?.monitor_id).toBeNull();
	});

	/** `monitorId: null` was, and stays, how a client widens an alert back to team-wide. */
	test("a null monitorId clears the scope entirely", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			monitor_type: "dns",
			monitor_id: crypto.randomUUID(),
		});

		await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, { monitorId: null }),
		);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBeNull();
		expect(updated?.monitor_id).toBeNull();
	});

	test("leaves the scope untouched when the update mentions neither field", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitorId = crypto.randomUUID();
		let alert = await createAlertRow(db, team.id, { monitor_type: "dns", monitor_id: monitorId });

		await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, { name: "Renamed" }),
		);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBe("dns");
		expect(updated?.monitor_id).toBe(monitorId);
	});

	test("404s when the alert doesn't belong to the team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, { name: "Hijacked" }),
		);
		expect(response.status).toBe(404);

		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.name).toBe("Site down");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), null, { name: "X" }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: alert.id }), key, { name: "X" }),
		);
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/alerts/:alertId", () => {
	test("deletes the alert", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);
		expect(await db.findOne(alerts, { where: { id: alert.id } })).toBeNull();
	});

	test("404s when the alert doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(404);
		expect(await db.findOne(alerts, { where: { id: alert.id } })).not.toBeNull();
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: alert.id }), null),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/alerts/:alertId/events", () => {
	test("lists the alert's delivery events, newest first", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		await db.create(
			alertEvents,
			{
				id: crypto.randomUUID(),
				sent_at: Date.now() - 1000,
				alert_id: alert.id,
				monitor_id: "monitor-1",
				event_type: "down",
				status: "sent",
				error_message: null,
				monitor_type: "http",
				monitor_name: "Example",
				snapshot: null,
			},
			{ touch: true, returnRow: true },
		);
		let newer = await db.create(
			alertEvents,
			{
				id: crypto.randomUUID(),
				sent_at: Date.now(),
				alert_id: alert.id,
				monitor_id: "monitor-1",
				event_type: "up",
				status: "sent",
				error_message: null,
				monitor_type: "http",
				monitor_name: "Example",
				snapshot: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertEvents.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { events: Array<{ id: string }> } };
		expect(body.data.events).toHaveLength(2);
		expect(body.data.events[0]?.id).toBe(newer.id);
	});

	test("404s when the alert doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertEvents.href({ alertId: alert.id }), key),
		);
		expect(response.status).toBe(404);
	});
});
