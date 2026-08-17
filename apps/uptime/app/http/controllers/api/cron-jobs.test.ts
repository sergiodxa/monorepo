/**
 * Tests the `/api/v1/cron-jobs` collection endpoints: listing a team's cron-job
 * monitors and creating one, both gated by a real `requireApiKey` bearer-token check
 * baked into the controller. Covers the happy paths, validation failure, invalid cron
 * expressions, missing/garbage auth, missing scope, and that a list never leaks
 * another team's monitors.
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
import CronJobMonitor from "~/app/data/cron-job";
import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: cronJobsController, cronJobsRoutes } = await import("./cron-jobs");

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
	router.map(cronJobsRoutes, cronJobsController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function indexRequest(headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.cronJobs.index.href()}`, { headers });
}

function createRequest(body: unknown, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.cronJobs.create.href()}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

function validCronJobBody(overrides: Record<string, unknown> = {}) {
	return {
		name: "Nightly backup",
		cronExpression: "0 2 * * *",
		...overrides,
	};
}

describe("GET /api/v1/cron-jobs", () => {
	test("lists the team's cron-job monitors", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);

		await CronJobMonitor.create(db, team.id, {
			name: "Nightly backup",
			description: null,
			cron_expression: "0 2 * * *",
			grace_period_seconds: 300,
			timezone: "UTC",
			alert_on_late: false,
			enabled_at: null,
		});

		let listResponse = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));
		expect(listResponse.status).toBe(200);
		let body = (await listResponse.json()) as { data: { cronJobs: { name: string }[] } };
		expect(body.data.cronJobs).toHaveLength(1);
		expect(body.data.cronJobs[0]?.name).toBe("Nightly backup");
	});

	test("only returns the calling team's cron-job monitors, not another team's", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);

		await CronJobMonitor.create(db, team.id, {
			name: "Mine",
			description: null,
			cron_expression: "0 2 * * *",
			grace_period_seconds: 300,
			timezone: "UTC",
			alert_on_late: false,
			enabled_at: null,
		});
		await CronJobMonitor.create(db, otherTeam.id, {
			name: "Theirs",
			description: null,
			cron_expression: "0 3 * * *",
			grace_period_seconds: 300,
			timezone: "UTC",
			alert_on_late: false,
			enabled_at: null,
		});

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));
		let body = (await response.json()) as { data: { cronJobs: { name: string }[] } };
		expect(body.data.cronJobs).toHaveLength(1);
		expect(body.data.cronJobs[0]?.name).toBe("Mine");
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

	test("returns 403 when the key lacks the cron-jobs:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/cron-jobs", () => {
	test("creates a cron-job monitor and returns 201 with the created row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);

		let response = await dispatch(
			db,
			createRequest(validCronJobBody(), { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: { cronJob: { id: string; name: string; cronExpression: string; status: string } };
		};
		expect(body.data.cronJob.name).toBe("Nightly backup");
		expect(body.data.cronJob.cronExpression).toBe("0 2 * * *");
		expect(body.data.cronJob.status).toBe("new");
	});

	test("returns 400 for a validation failure (blank name)", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);

		let response = await dispatch(
			db,
			createRequest(validCronJobBody({ name: "" }), { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
	});

	test("returns 400 for an invalid cron expression", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);

		let response = await dispatch(
			db,
			createRequest(validCronJobBody({ cronExpression: "not a cron expression" }), {
				Authorization: `Bearer ${key}`,
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		// The message names the reason and the index inside the expression the client sent,
		// so a client can point at the mistake instead of guessing which field was wrong.
		expect(body.error.message).toContain("field-count");
		expect(body.error.message).toContain("not a cron expression");
	});

	test("returns 400, not 500, for a timezone the IANA database doesn't know", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);

		let response = await dispatch(
			db,
			createRequest(validCronJobBody({ timezone: "Mars/Olympus_Mons" }), {
				Authorization: `Bearer ${key}`,
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toContain("Expected a valid IANA time zone");
	});

	test("keeps accepting UTC, the documented default", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);

		let response = await dispatch(
			db,
			createRequest(validCronJobBody({ timezone: "UTC" }), {
				Authorization: `Bearer ${key}`,
			}),
		);

		expect(response.status).toBe(201);
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, createRequest(validCronJobBody()));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the cron-jobs:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);

		let response = await dispatch(
			db,
			createRequest(validCronJobBody(), { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});
});
