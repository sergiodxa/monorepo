/**
 * Tests the `/api/v1/cron-jobs/:cronJobId` item endpoints: get/update/delete a single
 * cron-job monitor, all gated by a real `requireApiKey` bearer-token check baked into
 * the controller. Covers the happy paths, validation failure, an invalid cron
 * expression on update, missing/garbage auth, missing scope, and that a monitor
 * belonging to another team always 404s rather than 403ing or leaking the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import type { ApiKeyScope, SelectCronJobMonitor, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import CronJobMonitor from "~/app/data/cron-job";
import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: cronJobController, cronJobRoutes } = await import("./cron-job");

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

async function createCronJobRow(
	db: Db,
	teamId: string,
	overrides: Record<string, unknown> = {},
): Promise<SelectCronJobMonitor> {
	return await CronJobMonitor.create(db, teamId, {
		name: "Nightly backup",
		description: null,
		cron_expression: "0 2 * * *",
		grace_period_seconds: 300,
		timezone: "UTC",
		alert_on_late: false,
		enabled_at: null,
		...overrides,
	});
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(cronJobRoutes, cronJobController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function showRequest(cronJobId: string, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.cronJobs.show.href({ cronJobId })}`, {
		headers,
	});
}

function updateRequest(cronJobId: string, body: unknown, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.cronJobs.update.href({ cronJobId })}`, {
		method: "PUT",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

function destroyRequest(cronJobId: string, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.cronJobs.destroy.href({ cronJobId })}`, {
		method: "DELETE",
		headers,
	});
}

describe("GET /api/v1/cron-jobs/:cronJobId", () => {
	test("returns the cron-job monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(db, showRequest(cronJob.id, { Authorization: `Bearer ${key}` }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { cronJob: { id: string; name: string } } };
		expect(body.data.cronJob.id).toBe(cronJob.id);
		expect(body.data.cronJob.name).toBe("Nightly backup");
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(db, showRequest(cronJob.id));
		expect(response.status).toBe(401);
	});

	test("returns 401 when the Authorization header is garbage", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			showRequest(cronJob.id, { Authorization: "Bearer not-a-real-key" }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the cron-jobs:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(db, showRequest(cronJob.id, { Authorization: `Bearer ${key}` }));
		expect(response.status).toBe(403);
	});

	test("404s when the cron job doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);
		let cronJob = await createCronJobRow(db, otherTeam.id, { name: "Someone else's" });

		let response = await dispatch(db, showRequest(cronJob.id, { Authorization: `Bearer ${key}` }));
		expect(response.status).toBe(404);
	});
});

describe("PUT /api/v1/cron-jobs/:cronJobId", () => {
	test("updates the cron-job monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(
				cronJob.id,
				{ name: "New name", gracePeriodSeconds: 600 },
				{ Authorization: `Bearer ${key}` },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { cronJob: { name: string; gracePeriodSeconds: number } };
		};
		expect(body.data.cronJob.name).toBe("New name");
		expect(body.data.cronJob.gracePeriodSeconds).toBe(600);

		let updated = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(updated?.name).toBe("New name");
		expect(updated?.grace_period_seconds).toBe(600);
	});

	test("recomputes next_expected_at when the cron expression changes", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id, { enabled_at: Date.now() });
		let originalNextExpectedAt = cronJob.next_expected_at;

		let response = await dispatch(
			db,
			updateRequest(
				cronJob.id,
				{ cronExpression: "0 0 1 1 *" },
				{ Authorization: `Bearer ${key}` },
			),
		);

		expect(response.status).toBe(200);
		let updated = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(updated?.cron_expression).toBe("0 0 1 1 *");
		expect(updated?.next_expected_at).not.toBe(originalNextExpectedAt);
	});

	test("returns 400 for an invalid cron expression, without mutating the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(
				cronJob.id,
				{ cronExpression: "not a cron expression" },
				{ Authorization: `Bearer ${key}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");

		let unchanged = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(unchanged?.cron_expression).toBe("0 2 * * *");
	});

	test("returns 400 for a validation failure (grace period out of range)", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(cronJob.id, { gracePeriodSeconds: 1 }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
	});

	test("returns 400, not 500, for a timezone the IANA database doesn't know", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(
				cronJob.id,
				{ timezone: "Mars/Olympus_Mons" },
				{ Authorization: `Bearer ${key}` },
			),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toContain("Expected a valid IANA time zone");
	});

	test("keeps accepting UTC, so re-saving an existing job never fails on its own value", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(cronJob.id, { timezone: "UTC" }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(200);
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(db, updateRequest(cronJob.id, { name: "New name" }));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the cron-jobs:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(cronJob.id, { name: "New name" }, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});

	test("404s when the cron job doesn't belong to the team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, otherTeam.id, { name: "Someone else's" });

		let response = await dispatch(
			db,
			updateRequest(cronJob.id, { name: "Hijacked" }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(404);
		let unchanged = await CronJobMonitor.findByIdForTeam(db, otherTeam.id, cronJob.id);
		expect(unchanged?.name).toBe("Someone else's");
	});
});

describe("DELETE /api/v1/cron-jobs/:cronJobId", () => {
	test("deletes the cron-job monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			destroyRequest(cronJob.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);

		expect(await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id)).toBeNull();
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(db, destroyRequest(cronJob.id));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the cron-jobs:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			destroyRequest(cronJob.id, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});

	test("404s when the cron job doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			destroyRequest(cronJob.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(404);
		expect(await CronJobMonitor.findByIdForTeam(db, otherTeam.id, cronJob.id)).not.toBeNull();
	});
});
