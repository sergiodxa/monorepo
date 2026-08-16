/**
 * Tests `POST /api/v1/backfill-daily-stats`: enqueues an `aggregateDailyStats`
 * queue message and returns 202 Accepted, gated by
 * `requireApiKey("monitors:write")` like every other `/api/v1/*` endpoint. The
 * `env.QUEUE` binding is an in-memory queue installed through
 * `mock.module("cloudflare:workers", ...)`, since the controller reads `env` at
 * module load, so the assertions read the message that really landed on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";

import type { ApiKeyScope } from "~/database/schema";

/**
 * The queue the endpoint enqueues onto. Module scope because the controller captures
 * `env` on import, so it is emptied per test rather than rebuilt.
 */
let queue = createQueue({ name: "uptime" });

mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let { default: ApiKey } = await import("~/app/data/api-key");
let { createTestDatabase } = await import("~/app/lib/test/db");
let { teams } = await import("~/database/schema");
let { backfillDailyStatsCreate } = await import("./backfill-daily-stats");
let routes = (await import("~/routes/web")).default;

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
	router.map(routes.api.v1.backfillDailyStats, backfillDailyStatsCreate);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function post(key: string | null) {
	return new Request(`https://uptime.test${routes.api.v1.backfillDailyStats.href()}`, {
		method: "POST",
		headers: key ? { Authorization: `Bearer ${key}` } : {},
	});
}

beforeEach(() => {
	queue.reset();
});

describe("POST /api/v1/backfill-daily-stats", () => {
	test("enqueues an aggregateDailyStats message and returns 202", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:write"]);

		let response = await dispatch(db, post(key));
		expect(response.status).toBe(202);

		let body = (await response.json()) as { data: { status: string } };
		expect(body.data.status).toBe("queued");

		expect(queue.sent).toHaveLength(1);
		expect(queue.sent[0]?.body).toEqual({ type: "aggregateDailyStats" });
		expect(queue.sent[0]?.contentType).toBe("json");
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

	test("returns 403 for a key missing the monitors:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, post(key));
		expect(response.status).toBe(403);
		expect(queue.sent).toHaveLength(0);
	});
});
