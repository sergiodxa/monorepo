/**
 * Tests `POST /api/v1/backfill-daily-stats`: the operator's key, the one set as
 * `UPTIME_CRON_API_KEY`, enqueues an `aggregateDailyStats` message for every team and gets 202,
 * and every team's key is refused whatever its scopes. `env` is mocked so the test reads what
 * landed on the in-memory queue and decides which key is the operator's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { database } from "@sdxc/database-middleware";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import { checkConformance } from "~/app/test/openapi";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance({ backfillDailyStatsCreate: null });

/**
 * The queue the endpoint enqueues onto, kept at module scope since the controller
 * captures `env` on import; `beforeEach` resets it before each test.
 */
let queue = createQueue({ name: "uptime" });

/** The Worker's environment; each test sets `UPTIME_CRON_API_KEY` to the operator's key. */
let testEnv = createEnv<Env>({ QUEUE: queue, UPTIME_CRON_API_KEY: "" });

vi.doMock("cloudflare:workers", () => ({ env: testEnv }));

let { default: models } = await import("~/app/http/middleware/models");
let { createTestDatabase } = await import("~/app/test/db");
let { apiKeyScopes, teams } = await import("~/database/schema");
let { backfillDailyStatsCreate } = await import("./backfill-daily-stats");
let { jobQueue } = await import("~/app/initializers/queue");
let { bindModels } = await import("~/app/test/models");
let routes = (await import("~/routes/web")).default;

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db) {
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

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[]) {
	let { key } = unwrap(
		await bindModels(db).apiKeys.issue(teamId, { name: "test key", scopes, expires_at: null }),
	);
	return key;
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(db), models(), jobEnqueuer(jobQueue)],
	});
	router.map(routes.api.v1.backfillDailyStats, backfillDailyStatsCreate);

	return router.fetch(request);
}

function post(key: string | null) {
	return new Request(`https://uptime.test${routes.api.v1.backfillDailyStats.href()}`, {
		method: "POST",
		headers: key ? { Authorization: `Bearer ${key}` } : {},
	});
}

beforeEach(() => {
	queue.reset();
	testEnv.UPTIME_CRON_API_KEY = "";
});

describe("POST /api/v1/backfill-daily-stats", () => {
	test("enqueues an aggregateDailyStats message for the operator's key and returns 202", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["cron-jobs:ping"]);
		testEnv.UPTIME_CRON_API_KEY = key;

		let response = await dispatch(db, post(key));
		expect(response.status).toBe(202);

		let body = (await response.json()) as { data: { status: string } };
		expect(body.data.status).toBe("queued");

		expect(queue.sent).toHaveLength(1);
		expect(queue.sent[0]?.body).toEqual({ job: "aggregateDailyStats" });
		expect(queue.sent[0]?.contentType).toBe("json");
	});

	/**
	 * The rollup rewrites every team's stats, so a key from team A queueing it would be acting
	 * on team B's monitors. Any scope used to be enough with `monitors:write` among them.
	 */
	test("refuses a team's key holding every scope, leaving other teams' stats alone", async () => {
		let { db } = createTestDatabase();
		let operatorTeam = await createTeamRow(db);
		let teamA = await createTeamRow(db);
		testEnv.UPTIME_CRON_API_KEY = await createApiKey(db, operatorTeam.id, ["cron-jobs:ping"]);
		let key = await createApiKey(db, teamA.id, [...apiKeyScopes]);

		let response = await dispatch(db, post(key));

		expect(response.status).toBe(403);
		expect(queue.sent).toHaveLength(0);
	});

	test("refuses every key while the operator's key is unset", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);

		let response = await dispatch(db, post(key));

		expect(response.status).toBe(403);
		expect(queue.sent).toHaveLength(0);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, post(null));
		expect(response.status).toBe(401);
		expect(queue.sent).toHaveLength(0);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, post("not-a-real-key"));
		expect(response.status).toBe(401);
		expect(queue.sent).toHaveLength(0);
	});
});
