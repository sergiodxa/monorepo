/**
 * Tests `POST /api/v1/cron-jobs/:cronJobId/ping`, the dead man's switch ping
 * endpoint: authentication and scoping, the product rules for accepting or
 * refusing a ping, and which of those requests get billed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BillingError } from "@pkg/billing";
import billing from "@pkg/billing/middleware";
import { createAnalyticsEngine, createEnv, createRateLimit } from "@pkg/cloudflare-mocks";
import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { failure } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import CronJobMonitor from "~/app/data/cron-job";
import { MAIL_FROM } from "~/app/emails/sender";
import { billedEvents, createTestBilling } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import { cronJobMonitors, cronJobPings, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The binding's declared `simple.limit` in `wrangler.jsonc`, mirrored by the controller. */
const CALLER_LIMIT = 60;

/**
 * The `RATE_LIMITER` binding, counting per key against {@link CALLER_LIMIT}.
 * The clock is frozen so the fixed window can't roll over mid-test and hand
 * a caller spending its whole budget a fresh allowance mid-run.
 */
let rateLimiter = createRateLimit({ limit: CALLER_LIMIT, now: () => 0 });

/** The `PING_RESULTS` dataset, recording every point `writePingResult` writes. */
let pingResults = createAnalyticsEngine();

/**
 * Work the handler deferred past the response. Held rather than dropped so a
 * test can await ingestion that completes after the response already went out.
 */
let deferred: Promise<unknown>[] = [];

/**
 * Declared before the controller's dynamic import below: the caller budget
 * reads its rate-limiter backend off `env`, so the mock must exist first.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ RATE_LIMITER: rateLimiter, PING_RESULTS: pingResults }),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
}));

let { default: cronJobPing } = await import("~/app/http/controllers/api/cron-job-ping");

/**
 * The platform the endpoint bills against, replaced per test so one request's meter events
 * cannot be read back by the next. It is a real implementation, so the events asserted below
 * are the ones the endpoint actually built.
 */
let testBilling = createTestBilling();

beforeEach(() => {
	pingResults.reset();
	rateLimiter.reset();
	testBilling = createTestBilling();
	deferred = [];
});

/**
 * Every event the endpoint billed, as the fields that describe *what* was billed: the id and
 * the timestamp the platform stamps on a record are its own, not the endpoint's.
 */
async function billedFields() {
	return (await billedEvents(testBilling)).map(
		({ name, customerExternalId, externalId, metadata }) => ({
			name,
			customerExternalId,
			externalId,
			metadata,
		}),
	);
}

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

async function createApiKey(
	db: Db,
	teamId: string,
	scopes: ApiKeyScope[] = ["cron-jobs:ping"],
	expiresAt: number | null = null,
) {
	let { key } = await ApiKey.create(db, teamId, { name: "test", scopes, expires_at: expiresAt });
	return key;
}

async function createCronJobRow(db: Db, teamId: string, overrides: Record<string, unknown> = {}) {
	return await CronJobMonitor.create(db, teamId, {
		name: "Nightly backup",
		description: null,
		cron_expression: "0 0 * * *",
		grace_period_seconds: 300,
		timezone: "UTC",
		alert_on_late: false,
		enabled_at: Date.now(),
		...overrides,
	});
}

/** A team with a monitor and a key scoped to ping it — the shape most tests below need. */
async function createCaller(db: Db, overrides: Record<string, unknown> = {}) {
	let team = await createTeamRow(db);
	let monitor = await createCronJobRow(db, team.id, overrides);
	let key = await createApiKey(db, team.id);
	return { team, monitor, key };
}

/**
 * Routes the request through the full middleware stack, with mail sent over
 * a recording transport, and drains deferred work before returning so a
 * caller can await the ingestion the response itself doesn't wait for.
 */
async function dispatch(db: Db, request: Request) {
	let router = createRouter({
		middleware: [
			asyncContext(),
			billing({ provider: () => testBilling }),
			mail({ transport: new MemoryTransport(), from: MAIL_FROM }),
		],
	});
	router.map(routes.api.cronJobPing, cronJobPing);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let response = await container.scope(() => router.fetch(request));
	await Promise.all(deferred.splice(0));
	return response;
}

/**
 * A ping request, optionally authenticated and optionally from a named caller.
 * `CF-Connecting-IP` is the only address the caller budget keys on, so a test that omits
 * it lands in the shared "unknown" bucket — which is why the budget tests name one.
 */
function ping(cronJobId: string, options: { key?: string; address?: string } = {}) {
	let headers = new Headers();
	if (options.key !== undefined) headers.set("Authorization", `Bearer ${options.key}`);
	if (options.address !== undefined) headers.set("CF-Connecting-IP", options.address);

	return new Request(`https://uptime.test${routes.api.cronJobPing.href({ cronJobId })}`, {
		method: "POST",
		headers,
	});
}

/** Everything an accepted ping leaves behind, so a refusal can be asserted to leave none. */
async function recorded(db: Db, monitorId: string) {
	let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitorId } });
	return {
		pings: pings.length,
		dataPoints: pingResults.dataPoints.length,
		events: (await billedEvents(testBilling)).length,
	};
}

/**
 * The endpoint used to be open, with the monitor id in the URL as the only secret. It now
 * takes a key scoped to `cron-jobs:ping`, and a key belonging to one team reaches only
 * that team's monitors.
 */
describe("POST /api/v1/cron-jobs/:cronJobId/ping authentication", () => {
	test("returns 401 and records nothing without an Authorization header", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createCaller(db);

		let response = await dispatch(db, ping(monitor.id));

		expect(response.status).toBe(401);
		expect(await recorded(db, monitor.id)).toEqual({ pings: 0, dataPoints: 0, events: 0 });

		let unchanged = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(unchanged?.last_ping_at).toBeNull();
	});

	test("returns 401 for a key that does not exist", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createCaller(db);

		let response = await dispatch(db, ping(monitor.id, { key: "uptime_not_a_real_key" }));

		expect(response.status).toBe(401);
		expect(await recorded(db, monitor.id)).toEqual({ pings: 0, dataPoints: 0, events: 0 });
	});

	test("returns 401 for an expired key", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);
		let key = await createApiKey(db, team.id, ["cron-jobs:ping"], Date.now() - 1000);

		let response = await dispatch(db, ping(monitor.id, { key }));

		expect(response.status).toBe(401);
		expect(await recorded(db, monitor.id)).toEqual({ pings: 0, dataPoints: 0, events: 0 });
	});

	test("returns 403 and records nothing for a key without the cron-jobs:ping scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);
		let key = await createApiKey(db, team.id, ["cron-jobs:read", "cron-jobs:write"]);

		let response = await dispatch(db, ping(monitor.id, { key }));

		expect(response.status).toBe(403);
		expect(await recorded(db, monitor.id)).toEqual({ pings: 0, dataPoints: 0, events: 0 });
	});

	/**
	 * A 403 would confirm the id names a real monitor, turning the endpoint
	 * into a way to enumerate other teams' ids, so a valid key with the right
	 * scope still gets 404 for a monitor it doesn't own.
	 */
	test("returns 404, not 403, for another team's monitor", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createCaller(db);

		let intruder = await createTeamRow(db);
		let key = await createApiKey(db, intruder.id);

		let response = await dispatch(db, ping(monitor.id, { key }));

		expect(response.status).toBe(404);
		expect(response.status).not.toBe(403);
		expect(await recorded(db, monitor.id)).toEqual({ pings: 0, dataPoints: 0, events: 0 });
	});

	/**
	 * The caller budget is spent before authentication runs: while budget
	 * remains every attempt gets 401 from auth, and once it's gone the answer
	 * flips to 429 without ever costing a key lookup.
	 */
	test("spends the caller budget before authenticating", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createCaller(db);
		let address = "203.0.113.40";

		for (let attempt = 0; attempt < CALLER_LIMIT; attempt++) {
			let response = await dispatch(db, ping(monitor.id, { address }));
			expect(response.status).toBe(401);
		}

		let refused = await dispatch(db, ping(monitor.id, { address }));
		expect(refused.status).toBe(429);

		let body = (await refused.json()) as { error: string };
		expect(body.error).toBe("too_many_requests");
	});
});

describe("POST /api/v1/cron-jobs/:cronJobId/ping", () => {
	test("records an on-time ping and returns 201", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db);

		let response = await dispatch(db, ping(monitor.id, { key }));
		expect(response.status).toBe(201);

		let body = (await response.json()) as { wasOnTime: boolean };
		expect(body.wasOnTime).toBe(true);

		let updated = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(updated?.status).toBe("healthy");
		expect(updated?.last_ping_at).not.toBeNull();

		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(pings).toHaveLength(1);
		expect(pings[0]?.was_on_time).toBeTruthy();
	});

	test("returns 404 for an unknown cron job id", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id);

		let response = await dispatch(db, ping(crypto.randomUUID(), { key }));
		expect(response.status).toBe(404);
	});

	test("returns 409 for a disabled job", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db, { enabled_at: null });

		let response = await dispatch(db, ping(monitor.id, { key }));
		expect(response.status).toBe(409);

		let unchanged = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(unchanged?.last_ping_at).toBeNull();
	});

	test("returns 429 for a ping within the rate-limit window", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db);
		await CronJobMonitor.updateById(db, monitor.id, { last_ping_at: Date.now() - 1000 });

		let response = await dispatch(db, ping(monitor.id, { key }));
		expect(response.status).toBe(429);

		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(pings).toHaveLength(0);
	});

	/**
	 * Only the first ping succeeds; every refusal still spends caller budget,
	 * since a refusal's cost is what this limit bounds. The final refusal's
	 * own body shows the middleware refused it before the handler ran.
	 */
	test("refuses a caller that has spent its budget, and describes the policy", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db);
		let address = "203.0.113.10";

		for (let attempt = 0; attempt < CALLER_LIMIT; attempt++) {
			let response = await dispatch(db, ping(monitor.id, { key, address }));
			expect(response.status).toBe(attempt === 0 ? 201 : 429);
		}

		let refused = await dispatch(db, ping(monitor.id, { key, address }));
		expect(refused.status).toBe(429);
		expect(refused.headers.get("RateLimit-Policy")).toBe(`${CALLER_LIMIT};w=60`);

		let body = (await refused.json()) as { error: string };
		expect(body.error).toBe("too_many_requests");
	});

	/**
	 * The same caller pinging a different monitor draws on its own bucket, so
	 * a shared egress address can't let one noisy job starve every other job
	 * behind it.
	 */
	test("keeps one monitor's exhausted budget off another's", async () => {
		let { db } = createTestDatabase();
		let { team, monitor: noisy, key } = await createCaller(db);
		let quiet = await createCronJobRow(db, team.id);
		let address = "203.0.113.20";

		for (let attempt = 0; attempt <= CALLER_LIMIT; attempt++) {
			await dispatch(db, ping(noisy.id, { key, address }));
		}
		expect((await dispatch(db, ping(noisy.id, { key, address }))).status).toBe(429);

		let served = await dispatch(db, ping(quiet.id, { key, address }));
		expect(served.status).toBe(201);
	});
});

/**
 * A ping this endpoint accepts is one ping against the team's allowance, and only an
 * accepted one is: every refusal below performed no work, so billing it would charge a
 * caller for a request that recorded nothing.
 */
describe("POST /api/v1/cron-jobs/:cronJobId/ping billing", () => {
	test("bills an accepted ping once, keyed on the row it wrote", async () => {
		let { db } = createTestDatabase();
		let { team, monitor, key } = await createCaller(db);

		await dispatch(db, ping(monitor.id, { key, address: "203.0.113.30" }));

		let [row] = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(await billedFields()).toEqual([
			{
				name: "ping",
				customerExternalId: team.owner_id,
				externalId: `ping:${row?.id}`,
				metadata: { teamId: team.id, type: "cron", monitorId: monitor.id },
			},
		]);
	});

	/**
	 * A cron ping reports that the job ran elsewhere already, so it carries no
	 * latency of its own.
	 */
	test("records an accepted ping as up, with no latency it never measured", async () => {
		let { db } = createTestDatabase();
		let { team, monitor, key } = await createCaller(db);

		await dispatch(db, ping(monitor.id, { key, address: "203.0.113.31" }));

		expect(pingResults.dataPoints).toEqual([
			{ blobs: [monitor.id, "cron", "up"], doubles: [0, 1, 0, 0], indexes: [team.id] },
		]);
	});

	/**
	 * An hour past the default five-minute grace period counts as late, but a
	 * late ping is still a ping the team performed, so it still gets billed.
	 */
	test("records a ping that missed its deadline as degraded", async () => {
		let { db } = createTestDatabase();
		let { team, monitor, key } = await createCaller(db);
		await CronJobMonitor.updateById(db, monitor.id, { next_expected_at: Date.now() - 3_600_000 });

		await dispatch(db, ping(monitor.id, { key, address: "203.0.113.32" }));

		expect(pingResults.dataPoints).toEqual([
			{ blobs: [monitor.id, "cron", "degraded"], doubles: [0, 1, 0, 0], indexes: [team.id] },
		]);
		expect(await billedEvents(testBilling)).toHaveLength(1);
	});

	test("bills nothing for an unauthenticated ping", async () => {
		let { db } = createTestDatabase();
		let { monitor } = await createCaller(db);

		let response = await dispatch(db, ping(monitor.id, { address: "203.0.113.38" }));

		expect(response.status).toBe(401);
		expect(await billedEvents(testBilling)).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("bills nothing for a key without the cron-jobs:ping scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);
		let key = await createApiKey(db, team.id, ["cron-jobs:read"]);

		let response = await dispatch(db, ping(monitor.id, { key, address: "203.0.113.39" }));

		expect(response.status).toBe(403);
		expect(await billedEvents(testBilling)).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("bills nothing for an unknown cron job id", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id);

		let response = await dispatch(db, ping(crypto.randomUUID(), { key, address: "203.0.113.33" }));

		expect(response.status).toBe(404);
		expect(await billedEvents(testBilling)).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("bills nothing for a disabled job", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db, { enabled_at: null });

		let response = await dispatch(db, ping(monitor.id, { key, address: "203.0.113.34" }));

		expect(response.status).toBe(409);
		expect(await billedEvents(testBilling)).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	/**
	 * A refusal records nothing, so there is nothing to charge for — a job
	 * retrying inside its own window must not spend allowance on the refusals.
	 */
	test("bills nothing for a ping inside the per-monitor window", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db);
		await CronJobMonitor.updateById(db, monitor.id, { last_ping_at: Date.now() - 1000 });

		let response = await dispatch(db, ping(monitor.id, { key, address: "203.0.113.35" }));

		expect(response.status).toBe(429);
		expect(await billedEvents(testBilling)).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("bills nothing once the caller has spent its budget", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db);
		let address = "203.0.113.36";

		for (let attempt = 0; attempt <= CALLER_LIMIT; attempt++) {
			await dispatch(db, ping(monitor.id, { key, address }));
		}
		testBilling = createTestBilling();
		pingResults.reset();

		/** The middleware refuses the request, so the handler never runs at all. */
		let refused = await dispatch(db, ping(monitor.id, { key, address }));

		expect(refused.status).toBe(429);
		expect(await billedEvents(testBilling)).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("answers the caller even when ingestion is rejected", async () => {
		let { db } = createTestDatabase();
		let { monitor, key } = await createCaller(db);
		vi.spyOn(testBilling.usage, "ingest").mockResolvedValue(
			failure(
				new BillingError("meter unavailable", {
					code: "unknown",
					connection: testBilling.connection,
				}),
			),
		);

		let response = await dispatch(db, ping(monitor.id, { key, address: "203.0.113.37" }));

		/** A billing gap must not turn a caller's healthy job into a failed `curl`. */
		expect(response.status).toBe(201);
		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(pings).toHaveLength(1);
	});
});
