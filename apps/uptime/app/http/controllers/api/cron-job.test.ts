/**
 * Tests the `/api/v1/cron-jobs/:cronJobId` item endpoints: get/update/delete a single
 * cron-job monitor, all gated by a real `requireApiKey` bearer-token check baked into
 * the controller. Covers the happy paths, validation failure, an invalid cron
 * expression on update, missing/garbage auth, missing scope, and a monitor
 * belonging to another team always 404ing, keeping its existence hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope, SelectCronJobMonitor, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import CronJobMonitor from "~/app/data/cron-job";
import { database } from "~/app/http/middleware/database";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { checkConformance } from "~/app/lib/test/openapi";
import { expectProblem, problemMessages } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { teams } from "~/database/schema";
import { cronJobRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(cronJobRoutes);

let { default: cronJobController } = await import("./cron-job");

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
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(cronJobRoutes, cronJobController);

	return router.fetch(request);
}

/**
 * Each helper takes the stored UUID and encodes it, so a test names a row the way it
 * created it while the request still carries the `cron_…` identifier the API accepts.
 */
function showRequest(id: string, headers: Record<string, string> = {}) {
	let cronJobId = encodeId("cron", id);
	return new Request(`https://uptime.test${routes.api.v1.cronJobs.show.href({ cronJobId })}`, {
		headers,
	});
}

function updateRequest(id: string, body: unknown, headers: Record<string, string> = {}) {
	let cronJobId = encodeId("cron", id);
	return new Request(`https://uptime.test${routes.api.v1.cronJobs.update.href({ cronJobId })}`, {
		method: "PUT",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

function destroyRequest(id: string, headers: Record<string, string> = {}) {
	let cronJobId = encodeId("cron", id);
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
		expect(body.data.cronJob.id).toBe(encodeId("cron", cronJob.id));
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
		await expectProblem(response, "validationError");

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
		let body = await expectProblem(response, "validationError");
		expect(problemMessages(body)).toContain("Expected a valid IANA time zone");
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

describe("malformed cron job ids", () => {
	test.each([
		["GET", "show", "cron-jobs:read"],
		["PUT", "update", "cron-jobs:write"],
		["DELETE", "destroy", "cron-jobs:write"],
	] as const)("%s %s answers validation-error for a raw UUID", async (method, leaf, scope) => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, [scope]);
		let cronJob = await createCronJobRow(db, team.id);

		let init: RequestInit = {
			method,
			headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
		};
		if (method === "PUT") init.body = JSON.stringify({ name: "Renamed" });

		let response = await dispatch(
			db,
			new Request(
				`https://uptime.test${routes.api.v1.cronJobs[leaf].href({ cronJobId: cronJob.id })}`,
				init,
			),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "validationError");
	});
});

describe("PATCH /api/v1/cron-jobs/:cronJobId", () => {
	/** A merge patch request, sent as `application/merge-patch+json` unless told otherwise. */
	function mergePatch(
		id: string,
		body: unknown,
		options: { key?: string; contentType?: string } = {},
	) {
		let headers: Record<string, string> = {
			"content-type": options.contentType ?? "application/merge-patch+json",
		};
		if (options.key) headers.Authorization = `Bearer ${options.key}`;
		let cronJobId = encodeId("cron", id);
		return new Request(`https://uptime.test${routes.api.v1.cronJobs.patch.href({ cronJobId })}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(body),
		});
	}

	test("changes only the members the patch names", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id, { grace_period_seconds: 900 });

		let response = await dispatch(db, mergePatch(cronJob.id, { name: "Patched" }, { key }));

		expect(response.status).toBe(200);
		let updated = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(updated?.name).toBe("Patched");
		expect(updated?.grace_period_seconds).toBe(900);
		expect(updated?.cron_expression).toBe("0 2 * * *");
	});

	test("null clears the description and resets defaulted members", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id, {
			description: "Nightly",
			grace_period_seconds: 900,
			timezone: "America/Lima",
			alert_on_late: true,
		});

		let response = await dispatch(
			db,
			mergePatch(
				cronJob.id,
				{ description: null, gracePeriodSeconds: null, timezone: null, alertOnLate: null },
				{ key },
			),
		);

		expect(response.status).toBe(200);
		let updated = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(updated?.description).toBeNull();
		expect(updated?.grace_period_seconds).toBe(300);
		expect(updated?.timezone).toBe("UTC");
		expect(updated?.alert_on_late).toBe(false);
		expect(updated?.next_expected_at).toBe(
			CronJobMonitor.calculateNextExpected("0 2 * * *", "UTC"),
		);
	});

	test("null on a required member answers validation-error at its pointer", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(db, mergePatch(cronJob.id, { cronExpression: null }, { key }));

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/cronExpression"]);
	});

	test("re-sending enabled: true keeps the instant the job was enabled", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id, { enabled_at: 1000 });

		let response = await dispatch(db, mergePatch(cronJob.id, { enabled: true }, { key }));

		expect(response.status).toBe(200);
		let updated = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(updated?.enabled_at).toBe(1000);
	});

	test("accepts application/json as a merge patch", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id, { enabled_at: 1000 });

		let response = await dispatch(
			db,
			mergePatch(cronJob.id, { enabled: false }, { key, contentType: "application/json" }),
		);

		expect(response.status).toBe(200);
		let updated = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(updated?.enabled_at).toBeNull();
	});

	test("answers unsupported-media-type with Accept-Patch for any other body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(cronJob.id, { name: "x" }, { key, contentType: "text/plain" }),
		);

		expect(response.status).toBe(415);
		expect(response.headers.get("Accept-Patch")).toBe("application/merge-patch+json");
		await expectProblem(response, "unsupportedMediaType");
	});

	test("PUT keeps refusing null and resetting enabledAt on a re-sent enabled: true", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let cronJob = await createCronJobRow(db, team.id, { enabled_at: 1000 });
		let href = `https://uptime.test${routes.api.v1.cronJobs.update.href({ cronJobId: encodeId("cron", cronJob.id) })}`;
		let put = (body: unknown) =>
			new Request(href, {
				method: "PUT",
				headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
				body: JSON.stringify(body),
			});

		let refused = await dispatch(db, put({ gracePeriodSeconds: null }));
		let resent = await dispatch(db, put({ enabled: true }));

		expect(refused.status).toBe(400);
		expect(resent.status).toBe(200);
		let updated = await CronJobMonitor.findByIdForTeam(db, team.id, cronJob.id);
		expect(updated?.enabled_at).not.toBe(1000);
	});

	test("404s for another team's job, 401 without a key, 403 without cron-jobs:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let writer = await createApiKey(db, team.id, ["cron-jobs:write"]);
		let reader = await createApiKey(db, team.id, ["cron-jobs:read"]);
		let foreign = await createCronJobRow(db, otherTeam.id);
		let own = await createCronJobRow(db, team.id);

		let notFound = await dispatch(db, mergePatch(foreign.id, { name: "x" }, { key: writer }));
		let unauthorized = await dispatch(db, mergePatch(own.id, { name: "x" }));
		let forbidden = await dispatch(db, mergePatch(own.id, { name: "x" }, { key: reader }));

		expect([notFound.status, unauthorized.status, forbidden.status]).toEqual([404, 401, 403]);
	});
});
